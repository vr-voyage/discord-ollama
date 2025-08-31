import { ChannelType, Client, CommandInteraction, MessageFlags, TextChannel, ThreadChannel } from 'discord.js'
import { AdminCommand, openChannelInfo, SlashCommand } from '../utils/index.js'

export const ThreadCreate: SlashCommand = {
    name: 'thread',
    description: 'creates a thread and mentions user',

    options: [
        {
            name: 'title',
            description: 'The thread title',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],

    // Query for server information
    run: async (client: Client, interaction: CommandInteraction) => {
        // fetch the channel
        const channel = await client.channels.fetch(interaction.channelId)
        if (!channel || !AdminCommand.includes(channel.type)) return

        const threadName: string = interaction.options.getString('title') as string

        const thread = await (channel as TextChannel).threads.create({
            name: `${Date.now()}-${threadName.substring(0,50)}`,
            reason: `${Date.now()} : ${interaction.user} wants a thread !`,
            type: ChannelType.PublicThread
        })

        // Send a message in the thread
        thread.send(`Hello ${interaction.user} and others! \n\nIt's nice to meet you. Please talk to me by typing **@${client.user?.username}** with your message.`)

        // handle storing this chat channel
        openChannelInfo(thread.id, thread as ThreadChannel, interaction.user.tag)

        // user only reply
        return interaction.reply({
            content: `I can help you in <#${thread.id}> below.`,
            flags: MessageFlags.Ephemeral
        })
    }
}