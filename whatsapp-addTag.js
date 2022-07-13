module.exports = function (RED) {
    'use strict'

    function WhatsappAddTag(config) {
        RED.nodes.createNode(this, config)

        const node = this
        node.name = config.name
        node.to = config.to
        node.tag = config.tag
        node.sendRead = config.sendRead

        const clientNode = RED.nodes.getNode(config.client)

        if (clientNode) {
            console.log(clientNode)
        }

        node.on('input', async function (msg) {
            const to = msg.to || msg.payload.contactId || node.to
            const tag = msg.tag || node.tag

            clientNode.addTag(to, tag)

            node.send([null, msg])
        })
    }

    RED.nodes.registerType('whatsapp-addtag', WhatsappAddTag)
}
