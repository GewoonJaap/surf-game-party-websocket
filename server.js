const WebSocket = require('ws');
const uuid = require('uuid');
const {
    nanoid
} = require('nanoid');

const PORT = 8081;

let parties = [];

const wss = new WebSocket.Server({
    port: PORT
    //server
}, () => {
    console.log(`Party server started`);
});

setInterval(() => {
    console.log(`Online clients: ${wss.clients.size}`);
    console.log(parties);
    AutomaticClean();
}, 1000 * 10);

wss.on('connection', (ws, req) => {
    ws.clientId = uuid.v4();
    let party = createNewParty(ws);
    ws.party = party;

    console.log(`New connection: ${ws.clientId}, ${wss.clients.size}`);

    ws.send(JSON.stringify({
        type: "partyUpdate",
        party: getJsonReadyParty(party)
    }));



    ws.on('message', (data) => {
        data = JSON.parse(data);

    });

    ws.on('close', (data) => { 
        console.log(`User left: ${ws.clientId}, party: ${ws.party.partyId}`)
        removeFromLobby(ws);
    });

});

function getJsonReadyParty(party){
    const returnParty = {
        partyId: party.partyId,
        joinCode: party.joinCode,
        startTime: party.startTime,
        creator: party.creator,
        users: party.users.map(u => u.clientId)
    };
    return returnParty;
}

function getPartyById(partyId) {
    const lobby = parties.filter(function (party) {
        return party.partyId === partyId;
    });
    return lobby[0];
}

function createNewParty(client) {
    const newParty = {
        partyId: uuid.v4(),
        joinCode: nanoid(6),
        startTime: Date.now(),
        creator: client.clientId,
        users: [client]
    }
    parties.push(newParty);
    console.log(`Created a new party`, newParty)
    return newParty;
}

function removeFromLobby(user) {
    const party = parties.filter(function (party) {
        return party.partyId === user.partyId;
    })[0];

    if(!party) return;

    party.users = party.users.filter(function (el) {
        return el.clientId != user.clientId;
    });
    return;
}

function AutomaticClean() {
    console.log(`Cleaning`);
    for (let i = 0; i < parties.length; i++) {
        if (parties[i].users.length == 0) {
            console.log(`Removing lobby: ${parties[i].partyId}`)
            parties.splice(i, 1);
            return AutomaticClean();
        } else {
            parties[i].users = parties[i].users.filter(function (client) {
                return client.readyState === WebSocket.OPEN;
            });
        }
    }
}