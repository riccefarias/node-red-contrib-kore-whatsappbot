const { writeFileSync } = require('fs')

const saveContactStateFactory = (config) => {
    return (id, data) => {
        const sessionDir =
            config.storage + '/contacts/' + id.split('@')[0] + '.json'

        if (data) {
            return writeFileSync(sessionDir, JSON.stringify(data))
        } else {
            return false
        }
    }
}

module.exports = {
    saveContactStateFactory,
}
