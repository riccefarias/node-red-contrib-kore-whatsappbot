module.exports = function (RED) {
    'use strict'

    function WhatsappSendLocation(config) {
        RED.nodes.createNode(this, config)

        const node = this
        node.name = config.name
        node.to = config.to
        node.message = config.description
        node.latitude = config.latitude
        node.longitude = config.longitude

        const clientNode = RED.nodes.getNode(config.client)

        node.on('input', function (msg) {
            if (!clientNode) {
                node.error('Whatsapp client was not specified.')
            }

            const to = msg.to || node.to
            const message = msg.message || node.message
            const latitude = msg.latitude || node.latitude
            const longitude = msg.longitude || node.longitude

            if (to && latitude && longitude) {
                clientNode.sendlocation(to, latitude, longitude, message)
            } else {
                node.error(' all fields are required.')
            }
        })
    }

    RED.nodes.registerType('whatsapp-sendlocation', WhatsappSendLocation)
}
