import { GatewayIntentBits, SlashCommandBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, Events, ModalBuilder, ChannelType, Client, CommandInteraction, MessageFlags, TextChannel, ThreadChannel, StringSelectMenuBuilder } from 'discord.js'
import { AdminCommand, openChannelInfo, SlashCommand } from '../utils/index.js'
import { ollama } from "../client.js"
import { ListResponse, ModelResponse } from "ollama"

async function getOllamaModels() {
    return await ollama.list()
        .then(response => {
            const modelOptions = [];
            for (const model in response.models) {
                const currentModel: ModelResponse = response.models[model];
                
                modelOptions.push({
                    label: currentModel.name, 
                    description: currentModel.size_vram.toString() || 'No description available',
                    value: currentModel.name
                });
            }
            return modelOptions;
        })
        .catch(error => {
            console.error(`[Command: prompt] Failed to connect with Ollama service. Error: ${error.message}`);
            return [];
        });
}

export const Prompt: SlashCommand = {
    name: 'prompt',
    description: 'Sends a prompt to the bot and creates a thread for discussion.',

    // Query for server information
    run: async (client: Client, interaction: CommandInteraction) => {
        // fetch the channel
        const channel = await client.channels.fetch(interaction.channelId)
        if (!channel || !AdminCommand.includes(channel.type)) return

        // Create the modal
        const modal = new ModalBuilder()
            .setCustomId('prompt_modal')
            .setTitle('Prompt Input');

        const modelSelectionMenu = new StringSelectMenuBuilder({
            custom_id: 'model_selection',
            placeholder: 'Select a model',
            max_values: 1,
        });

        const modelOptions = await getOllamaModels();
        modelSelectionMenu.addOptions(modelOptions);

        const promptInput = new TextInputBuilder()
            .setCustomId('prompt_input')
            .setLabel('Prompt')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(4000);
 
        // Create action rows and add text inputs
        const firstRow = new ActionRowBuilder().addComponents(modelSelectionMenu);
        const secondRow = new ActionRowBuilder().addComponents(promptInput);

        modal.addComponents(firstRow, secondRow);
        return interaction.showModal(modal);
    }
}