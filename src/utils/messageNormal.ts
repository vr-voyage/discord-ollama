import { Message, SendableChannels } from 'discord.js'
import { ChatResponse, Ollama } from 'ollama'
import { ChatParams, UserMessage, streamResponse, blockResponse } from './index.js'
import { Queue } from '../queues/queue.js'
import { AbortableAsyncIterator } from 'ollama/src/utils.js'

/**
 * Splits a message into Discord-sized chunks at line breaks,
 * ensuring code blocks are properly terminated and restarted.
 */
function splitMessageWithCodeBlocks(text: string, maxLen: number = 1900): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    let buffer = '';
    let inCodeBlock = false;
    let codeLang = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect code block start
        if (!inCodeBlock && line.startsWith('```')) {
            inCodeBlock = true;
            codeLang = line.slice(3).trim();
        }

        // Detect code block end
        if (inCodeBlock && line.trim() === '```') {
            inCodeBlock = false;
            codeLang = '';
        }

        // If adding this line would exceed maxLen, flush buffer
        if ((buffer + line + '\n').length > maxLen) {
            if (inCodeBlock) buffer += '\n```';
            chunks.push(buffer);
            buffer = inCodeBlock ? '```' + codeLang + '\n' : '';
        }

        buffer += line + '\n';
    }

    // Flush remaining buffer
    if (buffer.trim().length > 0) {
        if (inCodeBlock) buffer += '\n```';
        chunks.push(buffer);
    }

    return chunks.map(chunk => chunk.trimEnd());
}

/**
 * Method to send replies as normal text on discord like any other user
 * @param message message sent by the user
 * @param model name of model to run query
 * @param msgHist message history between user and model
 */
export async function normalMessage(
    message: Message,
    ollama: Ollama,
    model: string,
    msgHist: Queue<UserMessage>,
    stream: boolean
): Promise<string> {
    // bot's respnse
    let response: ChatResponse | AbortableAsyncIterator<ChatResponse>
    let result: string = ''
    const channel = message.channel as SendableChannels

    await channel.send('Generating Response . . .').then(async sentMessage => {
        try {
            const params: ChatParams = {
                model: model,
                ollama: ollama,
                msgHist: msgHist.getItems()
            }

            // run query based on stream preference, true = stream, false = block
            if (stream) {
                let messageBlock: Message = sentMessage
                response = await streamResponse(params) // THIS WILL BE SLOW due to discord limits!
                for await (const portion of response) {
                    // check if over discord message limit
                    if (result.length + portion.message.content.length > 2000) {
                        result = portion.message.content

                        // new message block, wait for it to send and assign new block to respond.
                        await channel.send("Creating new stream block...")
                            .then(sentMessage => { messageBlock = sentMessage })
                    } else {
                        result += portion.message.content

                        // ensure block is not empty
                        if (result.length > 5)
                            messageBlock.edit(result)
                    }
                    console.log(result)
                }
            }
            else {
                response = await blockResponse(params)
                result = response.message.content

                // Split message at line breaks, handling code blocks
                const chunks = splitMessageWithCodeBlocks(result, 1900);

                // Edit first message
                sentMessage.edit(chunks[0]);

                // Send remaining chunks
                for (let j = 1; j < chunks.length; j++) {
                    await channel.send(chunks[j]);
                }
            }
        } catch (error: any) {
            console.log(`[Util: messageNormal] Error creating message: ${error.message}`)
            if (error.message.includes('fetch failed'))
                error.message = 'Missing ollama service on machine'
            else if (error.message.includes('try pulling it first'))
                error.message = `You do not have the ${model} downloaded. Ask an admin to pull it using the \`pull-model\` command.`
            sentMessage.edit(`**Response generation failed.**\n\nReason: ${error.message}`)
        }
    })

    // return the string representation of ollama query response
    return result
}
