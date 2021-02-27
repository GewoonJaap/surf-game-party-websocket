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

    sendCurrentPartyState(party);
    ws.send(JSON.stringify({
        type: "updateUserId",
        id: ws.clientId
    }));



    ws.on('message', (data) => {
        data = JSON.parse(data);
        console.log(data);
        if (data.type == "joinParty") {
            let foundParty = getPartyByJoinCode(data.partyId.toString().trim());
            if (!foundParty) return;
            removeFromParty(ws);
            addToParty(ws, foundParty)
        } else if (data.type == "createParty") {
            removeFromParty(ws);
            let party = createNewParty(ws);
            ws.party = party;
            sendCurrentPartyState(party);
        } else if (data.type == "updateMap") {
            ws.party.mapName = data.map;
            sendCurrentPartyState(party);
        }
    });

    ws.on('close', (data) => {
        console.log(`User left: ${ws.clientId}, party: ${ws.party.partyId}`)
        removeFromParty(ws);
    });

});

function getJsonReadyParty(party) {
    const returnParty = {
        partyId: party.partyId,
        joinCode: party.joinCode,
        startTime: party.startTime,
        creator: party.creator,
        users: party.users.map(u => u.clientId),
        mapName: party.mapName
    };
    return returnParty;
}

function getPartyByJoinCode(partyCode) {
    console.log(partyCode)
    const foundParty = parties.filter(function (party) {
        return party.joinCode.localeCompare(partyCode) == 0;
    });
    return foundParty[0];
}

function getPartyById(partyId) {
    const foundParty = parties.filter(function (party) {
        return party.partyId.localeCompare(partyId) == 0;
    });
    return foundParty[0];
}

function createNewParty(client) {
    let joinCode = nanoid(6);

    const newParty = {
        partyId: uuid.v4(),
        joinCode: joinCode,
        startTime: Date.now(),
        creator: client.clientId,
        users: [client],
        mapName: "MainMenu"
    }
    parties.push(newParty);
    console.log(`Created a new party`, newParty)
    return newParty;
}

function removeFromParty(user) {
    const party = parties.filter(function (party) {
        return party.partyId.localeCompare(user.party.partyId) == 0;
    })[0];
    if (!party) return;

    party.users = party.users.filter(function (el) {
        return el.clientId.localeCompare(user.clientId) != 0
    });
    console.log(`Removed: ${user.clientId} from party`, party)
    sendCurrentPartyState(party);
    party.users.forEach(user => user.send(JSON.stringify({
        type: "userLeft",
        id: user.clientId
    })))
    return;
}

function addToParty(user, party) {
    party.users.push(user);
    sendCurrentPartyState(party);
}

function sendCurrentPartyState(party) {
    const jsonReadyParty = getJsonReadyParty(party);
    party.users.forEach(partyUser => {
        partyUser.send(JSON.stringify({
            type: "partyUpdate",
            party: jsonReadyParty
        }));
    })
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
                return client.readyState === WebSocket.OPEN && client.party.partyId.localeCompare(parties[i].partyId) == 0;
            });
            sendCurrentPartyState(parties[i]);
        }
    }
}