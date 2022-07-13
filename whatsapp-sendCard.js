module.exports = function (RED) {
    'use strict'

    function WhatsappSendCard(config) {
        RED.nodes.createNode(this, config)

        const node = this
        node.name = config.name
        node.to = config.to
        node.displayName = config.displayName
        node.cards = config.cards

        const clientNode = RED.nodes.getNode(config.client)

        node.on('input', function (msg) {
            if (!clientNode) {
                node.error('Whatsapp client was not specified.')
            }

            const to = msg.to || node.to
            const displayName = msg.displayName || node.displayName
            const cards = msg.cards || node.cards

            console.log(to, displayName, cards)

            if (to && displayName && cards) {
                clientNode.sendcard(to, displayName, cards)
            } else {
                node.error(' all fields are required.')
            }
        })
    }

    RED.nodes.registerType('whatsapp-sendcard', WhatsappSendCard)
}
