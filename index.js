/// <reference types="../CTAutocomplete-2.0.4" />
/// <reference lib="es2015" />

function getJsonFromFile(fileName) {
    return JSON.parse(FileLib.read(`./config/ChatTriggers/modules/HousingBot/housing-data/${fileName}.json`));
}

const buttons = getJsonFromFile('button-data');
const maps = getJsonFromFile('map-templates');
const features = getJsonFromFile('features');


// World.getAllPlayers().forEach(player => {
//     player.getActivePotionEffects().forEach(potion => {
//         console.log(potion.getName())
//     })
// })

// // S0BPacketAnimation || Entity Animation (clientbound) https://mcp.thiakil.com/#/class/net.minecraft.network.play.server.S0BPacketAnimation

// const S0BPacketAnimation = net.minecraft.network.play.server.S0BPacketAnimation;
// const OtherPlayerMP = net.minecraft.client.entity.EntityOtherPlayerMP;
// // Sent whenever an entity should change animation.
// // +----+-----------------------+
// // | ID |       Animation       |
// // +----+-----------------------+
// // |  0 | Swing main arm        |
// // |  1 | Take damage           |
// // |  2 | Leave bed             |
// // |  3 | Swing offhand         |
// // |  4 | Critical effect       |
// // |  5 | Magic critical effect |
// // +----+-----------------------+

// register('packetReceived', (packet, event) => {
//     if (packet instanceof S0BPacketAnimation) { // Check if the incoming packet is an animation packet
//         var entityId = packet.func_148978_c();
//         var animationType = packet.func_148977_d();
//         if (animationType === 0) { // Check if it's a left clicking animation.
//             var entity = World.getWorld().func_73045_a(entityId);

//             if (entity instanceof OtherPlayerMP) {
//                 var player = new PlayerMP(entity);
//                 player.setIsInvisible(false)
//                 console.log(player.getPos()+'')

//             }
//         }
//     }
// });

var botSelection = {posa: [], posb: []};

var gameLoop = false;

var gameData = {
    mapSelection: null,
    previousMap: null,
    lastGameTick: null,
    gameTick: 0,
    gameStartTimestamp: null,
    gameRunning: false,
    gameLength: 1000 * 30, // 7 seconds
    playersInHousing: [],
    playersInArena: [],
}

gameData.mapSelection = getRandomMap();

const arenaCorners = [[19,160,-8],[-40,195,51]]
const arenaWidth = Math.abs(arenaCorners[0][0]-arenaCorners[1][0]);
const arenaLength = Math.abs(arenaCorners[0][2]-arenaCorners[1][2]);

var futureActions = [];

class Action {
    constructor(data) {
        this.run = data.action;
        futureActions.push(this)
    }
}

// action example

// new Action({
//     action: () => {
//         World.getAllPlayers().forEach(player => {
//             runCommand(`/tp ${player.getName()} 0 0 0`)
//         })
//     }
// })

var commandsToRun = [];
var commandLastRan = 0;

var commandsLastRan = {
    paste: 0,
    replace: 0,
    fill: 0,
    cut: 0,
    set: 0,
}
var commandCooldownLengths = {
    paste: 5000,
    replace: 5000,
    fill: 5000,
    cut: 5000,
    set: 5000,
}

function processActions() {

    // if there are no commands to run, run the next action
    if (commandsToRun.length === 0) {
        if (futureActions.length > 0) {
            futureActions[0].run();
            futureActions.shift();
        }
    }

    // if a command gets timed out, run the timeout callback and remove the command from the queue
    commandsToRun.forEach(command => {
        if (command.pushed + command.timeout < Date.now()) {
            if (command.timeoutCallback) {
                command.timeoutCallback();
            }
            commandsToRun.splice(commandsToRun.indexOf(command), 1);
            return;
        }
    })

    if (commandsToRun.length > 0) {

        // minimum time between commands is 1 second
        if ((Date.now() - commandLastRan) > 1000) {

            let type = commandsToRun[0].command.split(' ')[0].replace(/\//g,'');
            if (typeof commandCooldownLengths[type] === 'undefined') {
                if (type === 'posa' || type === 'pos1') {
                    botSelection.posa = [Player.getX(),Player.getY(),Player.getZ()];
                } else if (type === 'posb' || type === 'pos2') {
                    botSelection.posb = [Player.getX(),Player.getY(),Player.getZ()];
                }
                ChatLib.say(commandsToRun[0].command);
                commandsToRun.shift();
                commandLastRan = Date.now();
                return;
            }
            if ((Date.now() - commandsLastRan[type]) > commandCooldownLengths[type]) {
                ChatLib.say(commandsToRun[0].command);
                commandsToRun.shift();
                commandsLastRan[type] = Date.now();
                commandLastRan = Date.now();
            } else {
                for (i = 0; i < commandsToRun.length; i++) {
                    let element = commandsToRun[i];
                    if (element.reorder === true) {
                        ChatLib.say(commandsToRun[i].command);
                        commandLastRan = Date.now();
                        commandsToRun.splice(i--,1);
                        break;
                    }
                }
            }
        }
    }
}

function defaultCommandTimeoutCallback() {
    // console log the amount of players online, the amount of players in the arena and the timestamp
    console.warn('Warning: Timeout for command: ' + this.command + ' has occurred.' + '\n' +
    '   Players online: ' + gameData.playersInHousing.length + '\n' +
    '   Players in arena: ' + gameData.playersInArena.length + '\n' +
    '   Timestamp: ' + new Date(Date.now()).toISOString());

}

// why command timeouts?
// command timeouts are useful for when a player uses a clickable item while the bot has a long queue of commands to run.
// this prevents from the item being used e.g 20 seconds later and instead doesn't use it at all.
// the item will simply not work for the player.

function runCommand(command,reorder = false,timeout = Infinity, timeoutCallback = defaultCommandTimeoutCallback) {
    commandsToRun.push({command: command, reorder: reorder, timeout: timeout, timeoutCallback: timeoutCallback, pushed: Date.now()});
}

var tickNum = 0;
register('tick', () => {
    tickNum++;

    // set the amount of players in the arena
    gameData.playersInArena = World.getAllPlayers().filter(player => {
        if (isPlayer(player)) {
            return coordsInArea(arenaCorners[0], arenaCorners[1], getEntityPos(player));
        }
    });

    // set the amount of players in the housing
    gameData.playersInHousing = World.getAllPlayers().filter(player => {
        return isPlayer(player);
    });

    // go through each button in the buttons and if it was clicked then run the code for the button
    for(var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        if (World.getBlockAt(...button.location).getState().toString().includes('powered=true')) {
            if (button.powered === false) {
                switch (button.name) {
                    case 'start-game':
                        loadMap();
                        break;
                    case 'reset-map':
                        resetMap();
                        break;
                    case 'clear-queue':
                        futureActions = [];
                        commandsToRun = [];
                        break;
                    case 'disaster-test-sinkhole':
                        disasterTestSinkhole();
                        break;
                    case 'disaster-test-acid-rain':
                        disasterTestAcidRain();
                        break;
                    case 'disaster-test-flood':
                        disasterTestFlood();
                        break;
                    case 'disaster-test-blizzard':
                        disasterTestBlizzard();
                        break;
                    case 'disaster-test-lava-flood':
                        disasterTestLavaFlood();
                        break;
                    case 'disaster-test-sandstorm':
                        disasterTestSandstorm();
                        break;
                    case 'disaster-test-lava-falls':
                        disasterTestLavaFalls();
                        break;
                    case 'checkered_selection':
                        gameData.mapSelection = 'checkered';
                        break;
                    case 'canyon_selection':
                        gameData.mapSelection = 'canyon';
                        break;
                    case 'developer_selection':
                        gameData.mapSelection = 'developer';
                        break;
                    case 'city_selection':
                        gameData.mapSelection = 'city';
                        break;
                    case 'walled_garden_selection':
                        gameData.mapSelection = 'walled_garden';
                        break;
                    case 'mario_kart_selection':
                        gameData.mapSelection = 'mario_kart';
                        break;
                    case 'small_islands_selection':
                        gameData.mapSelection = 'small_islands';
                        break;
                    case 'beach_selection':
                        gameData.mapSelection = 'beach';
                        break;
                    case 'rainbow_selection':
                        gameData.mapSelection = 'rainbow';
                        break;
                    case 'observatory_selection':
                        gameData.mapSelection = 'observatory';
                        break;
                    case 'cosmos_selection':
                        gameData.mapSelection = 'cosmos';
                        break;
                    case 'tall_house_selection':
                        gameData.mapSelection = 'tall_house';
                        break;
                    case 'cliffside_selection':
                        gameData.mapSelection = 'cliffside';
                        break;
                    case 'stellaris_selection':
                        gameData.mapSelection = 'stellaris';
                        break;
                    case 'spooky_selection':
                        gameData.mapSelection = 'spooky';
                        break;
                    case 'log_game_data':
                        console.log(JSON.stringify(gameData))
                        break;
                }
                button.powered = true;
            }
        } else {
            button.powered = false;
        }
    }

    if (gameLoop) {
        if (gameData.gameRunning === true) {
            gameTick()
        } else {
            if (checkIfGameReady()) {
                startGame();
            }
        }
    
        // end game if it has been more than x minutes since the game started
        if (Date.now() - gameData.gameStartTimestamp > gameData.gameLength && gameData.gameRunning === true) {
            endGame();
        }    
    }

    processActions()

})

function getRandomMap() {
    var validMaps = Object.keys(maps).filter(map => {
        return map !== gameData.previousMap;
    })
    return validMaps[Math.floor(Math.random() * validMaps.length)];
}

function getRandomFeature(x,y,z) {
    var validFeatures = Object.keys(features).filter(featureName => {
        if (getFeatureSize(features[featureName]).toString() === [x,y,z].toString()) {
            return true;
        }
    })
    return validFeatures[Math.floor(Math.random() * validFeatures.length)];
}

function getFeatureSize(feature) {
    return [Math.abs(feature.corners[1][0]-feature.corners[0][0])+1,
            Math.abs(feature.corners[1][1]-feature.corners[0][1])+1,
            Math.abs(feature.corners[1][2]-feature.corners[0][2])+1];
}

function startGame() {
    gameData.gameStartTimestamp = Date.now();
    gameData.gameRunning = true;
    gameData.gameTick = 0;
    console.log(getRandomMap())


    resetArena();
    // resetDisplays();

    // setPlayerDisplay(gameData.playersInHousing.length);

    loadMapTemplate(gameData.mapSelection)

    // load the maps features
    for (featureSize in maps[gameData.mapSelection]['feature_placements']) {
        maps[gameData.mapSelection]['feature_placements'][featureSize].forEach(placementSpot => {
            var randomFeature = getRandomFeature(...featureSize.split('x'));
            console.log(randomFeature,placementSpot)
            if (randomFeature) {
                loadFeature(randomFeature,placementSpot);
            }
        })
    }

    gameData.previousMap = gameData.mapSelection;
    // set random map for next game
    gameData.mapSelection = getRandomMap();



    ChatLib.chat('the game has started');
}

// startGame()

function endGame() {
    gameData.gameRunning = false;

    ChatLib.chat('the game has ended');
}

function gameTick() {
    gameData.gameTick++;
    gameData.lastGameTick = Date.now();
    console.log(gameData.gameTick);
}

function resetDisplays() { // the redstone displays
    new Action({
        action: function() {
            runCommand(`/tp ${centerBlock(-44)} ${155} ${centerBlock(-6)}`);
            runCommand('/pos1');

            runCommand(`/tp ${centerBlock(-53)} ${172} ${centerBlock(49)}`);
            runCommand('/pos2');

            runCommand('/copy')

            runCommand(`/tp ${centerBlock(-44)} ${174} ${centerBlock(-6)}`);
            runCommand('/paste')
        }
    })
}

function resetArena() {
    runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[0][1]} ${arenaCorners[0][2]}`)
    runCommand('/pos1')
    runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]} ${arenaCorners[1][2]}`)
    runCommand('/pos2')
    runCommand('/set 0')
}

function loadMapTemplate(mapName) {
    const map = maps[mapName];
    console.log(map,mapName)
    // copy map
    runCommand(`/tp ${centerBlock(map.corners[0][0])} ${map.corners[0][1]} ${centerBlock(map.corners[0][2])}`)
    runCommand('/pos1')
    runCommand(`/tp ${centerBlock(map.corners[1][0])} ${map.corners[1][1]} ${centerBlock(map.corners[1][2])}`)
    runCommand('/pos2')
    runCommand('/copy')

    // paste the map in the arena (centered)
    const depthWidth = centerBlock(arenaCorners[0][0]+getMapDepth(mapName)[0],0.5);
    const depthLength = centerBlock(arenaCorners[0][2]+getMapDepth(mapName)[1],0.5);
    const depthHeight = arenaCorners[0][1]+3;

    runCommand(`/tp ${depthWidth} ${depthHeight} ${depthLength}`);
    runCommand('/paste')
    runCommand('/paste')
}

function loadFeature(featureName,pos) {
    const feature = features[featureName];

    // copy feature
    runCommand(`/tp ${centerBlock(feature.corners[0][0])} ${centerBlock(feature.corners[0][1])} ${centerBlock(feature.corners[0][2])}`)
    runCommand('/pos1')
    runCommand(`/tp ${centerBlock(feature.corners[1][0])} ${centerBlock(feature.corners[1][1])} ${centerBlock(feature.corners[1][2])}`)
    runCommand('/pos2')
    runCommand('/copy')

    // paste at correct location
    runCommand(`/tp ${centerBlock(pos[0])} ${centerBlock(pos[1])} ${centerBlock(pos[2])}`)
    runCommand('/paste')
    if (features[featureName].double_paste) {
        runCommand(`/tp ${centerBlock(pos[0])} ${pos[1]} ${centerBlock(pos[2])}`)
        runCommand('/paste')
    }
}

function getMapDimensions() {
    var mapName = gameData.mapSelection;
    var mapWidth = Math.abs(maps[mapName].corners[0][0]-maps[mapName].corners[1][0]);
    var mapHeight = Math.abs(maps[mapName].corners[0][1]-maps[mapName].corners[1][1]);
    var mapLength = Math.abs(maps[mapName].corners[0][2]-maps[mapName].corners[1][2]);
    return [mapWidth, mapHeight, mapLength];
}

function getMapDepth(mapName) {
    const map = maps[mapName];

    const mapWidth = Math.abs(map.corners[0][0]-map.corners[1][0]);
    const mapLength = Math.abs(map.corners[0][2]-map.corners[1][2]);

    const depthWidth = (arenaWidth-mapWidth)/2;
    const depthLength = (arenaLength-mapLength)/2;

    return [-depthWidth,depthLength]
}

function getArenaCenter() {
    centerWidth = (-Math.abs(arenaCorners[0][0]-arenaCorners[1][0])/2)+arenaCorners[0][0];
    centerLength = (Math.abs(arenaCorners[0][2]-arenaCorners[1][2])/2)+arenaCorners[0][2];
    return [centerWidth, centerLength]
}

// function disasterTestSinkhole() {
//     var centerX = getArenaCenter()[0];
//     var centerZ = getArenaCenter()[1];
    
//     for (var i = 0; i < getMapDimensions()[0]/2; i++) {
//         let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
//         futureActions.push({
//             run: function() {
//                 var blockCount = getMostCommonBlocks(centerX+dist,arenaCorners[0][1],centerZ+dist,centerX-dist,arenaCorners[1][1],centerZ-dist);
                
//                 var sortable = [];
                
//                 for (block in blockCount) {
//                     if (block === '13') continue;
//                     sortable.push([block,blockCount[block]]);
//                 }
                
//                 sortable.sort(function(a,b) {
//                     return a[1] - b[1];
//                 })
                
//                 console.log(JSON.stringify(sortable))
//                 while (sortable.length > 0 && sortable[sortable.length-1][1] > dist * 8) {
//                     console.log(sortable[sortable.length-1][0])
//                     runCommand(`/tp ${centerX+dist} ${arenaCorners[0][1]} ${centerZ+dist}`)
//                     runCommand('/posa')
//                     runCommand(`/tp ${centerX-dist} ${arenaCorners[1][1]} ${centerZ-dist}`)
//                     runCommand('/posb')
//                     runCommand(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},gravel`);
//                     sortable.pop();
//                 }
                
//                 var uncommon = [];
                
//                 for (block in sortable) {
//                     if (block[1] < dist * 2) {
//                         uncommon.push(block[0]);
//                     }
//                 }
                
//                 if (dist % 4 === 0) {
//                     if (uncommon.length > 0) {
//                         runCommand(`/tp ${centerX+dist} 156 ${centerZ+dist}`)
//                         runCommand('/posa')
//                         runCommand(`/tp ${centerX-dist} 190 ${centerZ-dist}`)
//                         runCommand('/posb')
//                         runCommand(`/replace ${uncommon.join(',')} ${uncommon.join(',')},gravel`);
//                     }
//                 }
                
//             }
//         })
//     }
// }

// function disasterTestAcidRain() {
//     runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`);
//     runCommand('/posa');
    
//     for (var i = 0; i < 15; i++) {
//         let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
        
//         new Action({
//             action: function() {
                
//                 var blockCount = getMostCommonBlocks(arenaCorners[0][0],arenaCorners[1][1],arenaCorners[0][2],arenaCorners[1][0],arenaCorners[1][1]-dist,arenaCorners[1][2]);
//                 // console.log(JSON.stringify(blockCount))
                
//                 var sortable = [];
                
//                 for (block in blockCount) {
//                     if (block === '95:5' || block === '95:13') continue;
//                     sortable.push([block,blockCount[block]]);
//                 }
                
//                 sortable.sort(function(a,b) {
//                     return a[1] - b[1];
//                 })
                
//                 for (var j = 0; j < 1; j++) {
//                     if (sortable.length > 0) {
//                         runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`);
//                         runCommand('/posb');
//                         runCommand(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},95:5,95:13,0`);
//                         console.log(sortable[sortable.length-1][0]);
//                     }
//                     sortable.pop();
//                 }
                
//                 // Every 4 blocks remove the uncommon blocks
                
//                 var uncommon = [];
                
//                 for (block in sortable) {
//                     if (block[1] < 30) {
//                         uncommon.push(block[0]);
//                     }
//                 }
                
//                 // console.log('BLOCK COUNTS: '+JSON.stringify(blockCount))
                
//                 // if (dist % 4 === 0) {
//                     //     if (uncommon.length > 0) {
//                         //         runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
//                         //         runCommand('/posa')
//                         //         runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
//                 //         runCommand('/posb')
//                 //         runCommand(`/replace ${uncommon.join(',')},95:5,95:13 95:5,95:13,0,0,0,0,0,0,0,0`);
//                 //     }
//                 // }
                
//             }
//         })
//     }
    
// }

// function disasterTestBlizzard() {
//     runCommand('/weather raining')
//     runCommand('/setbiome cold_taiga')
    
//     for (var i = 0; i < 39; i++) {
//         let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
        
//         futureActions.push({
//             run: function() {
//                 var blockCount = getMostCommonBlocks(arenaCorners[0][0],arenaCorners[1][1],arenaCorners[0][2],arenaCorners[1][0],arenaCorners[1][1]-dist,arenaCorners[1][2]);
//                 // console.log(JSON.stringify(blockCount))
                
//                 var sortable = [];
                
//                 for (block in blockCount) {
//                     if (block === '80:' || block === '79:' || block === '174:') continue;
//                     sortable.push([block,blockCount[block]]);
//                 }
                
//                 sortable.sort(function(a,b) {
//                     return a[1] - b[1];
//                 })
                
//                 for (var j = 0; j < 2; j++) {
//                     if (sortable.length > 0) {
//                         runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`);
//                         runCommand('/posa');
//                         runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`);
//                         runCommand('/posb');
//                         runCommand(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},80`);
//                         console.log(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},80`);
//                     }
//                     sortable.pop();
//                 }
                
//                 // Every 4 blocks remove the uncommon blocks
                
//                 var uncommon = [];
                
//                 for (block in sortable) {
//                     if (block[1] < 30) {
//                         uncommon.push(block[0]);
//                     }
//                 }
                
//                 // console.log('BLOCK COUNTS: '+JSON.stringify(blockCount))
                
//                 if (dist % 4 === 0) {
//                     if (uncommon.length > 0) {
//                         runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
//                         runCommand('/posa')
//                         runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
//                         runCommand('/posb')
//                         runCommand(`/replace ${uncommon.join(',')},80,79,174 80,79,174,0,0,0,0`);
//                     }
//                 }
                
//                 // if (Object.keys(blockCount).length !== 0) {
                    
//                     //     var max = Object.keys(blockCount).reduce((a, b) => blockCount[a] > blockCount[b] ? a : b);
                    
//                     //     // console.log(max)
//                     //     runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
//                     //     runCommand('/posa')
//                     //     runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
//                     //     runCommand('/posb')
//                     //     runCommand(`/replace ${max},95:5,95:13 ${max},95:5,95:13,0,0,0`);
//                     //     console.log(max)
//                     //     // `/replace ${max},95:5,95:13,159:5,159:13 ${max},${max},${max},${max},${max},95:5,95:13,159:5,159:13,0` 
//                     // };
//                 }
//             })
//         }
//     }
    
// function disasterTestSandstorm() {
//     runCommand('/setbiome desert')
    
//     for (var k = 0; k < 1; k++) {
//         for (var i = 0; i < 39; i++) {
//             let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
            
//             futureActions.push({
//                 run: function() {
//                     var blockCount = getMostCommonBlocks(arenaCorners[0][0],arenaCorners[1][1],arenaCorners[0][2],arenaCorners[1][0],arenaCorners[1][1]-dist,arenaCorners[1][2]);
//                     // console.log(JSON.stringify(blockCount))
                    
//                     var sortable = [];
                    
//                     for (block in blockCount) {
//                         if (block === '12:' || block === '24:') continue;
//                         sortable.push([block,blockCount[block]]);
//                     }
                    
//                     sortable.sort(function(a,b) {
//                         return a[1] - b[1];
//                     })

//                     for (var j = 0; j < 1; j++) {
//                         if (sortable.length > 0) {
//                         runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`);
//                         runCommand('/posa');
//                         runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`);
//                         runCommand('/posb');
//                         runCommand(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},12`);
                        
//                     }
//                     sortable.pop();
//                 }

//                 // Every 4 blocks remove the uncommon blocks
                
//                 var uncommon = [];
                
//                 for (block in sortable) {
//                     if (block[1] < 30) {
//                         uncommon.push(block[0]);
//                     }
//                 }

//                 // console.log('BLOCK COUNTS: '+JSON.stringify(blockCount))
                
//                 if (dist % 4 === 0) {
//                     if (uncommon.length > 0) {
//                         runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
//                         runCommand('/posa')
//                         runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
//                         runCommand('/posb')
//                         runCommand(`/replace ${uncommon.join(',')},12,24 12,24,0,0,`);
//                         runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`);
//                         runCommand('/posa');
//                         runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]} ${arenaCorners[1][2]}`);
//                         runCommand('/posb');
//                         runCommand(`/replace 0 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12`);
//                     }
//                 }
                
//                 // if (Object.keys(blockCount).length !== 0) {
                    
//                     //     var max = Object.keys(blockCount).reduce((a, b) => blockCount[a] > blockCount[b] ? a : b);
                    
//                     //     // console.log(max)
//                     //     runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
//                     //     runCommand('/posa')
//                     //     runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
//                     //     runCommand('/posb')
//                     //     runCommand(`/replace ${max},95:5,95:13 ${max},95:5,95:13,0,0,0`);
//                     //     console.log(max)
//                 //     // `/replace ${max},95:5,95:13,159:5,159:13 ${max},${max},${max},${max},${max},95:5,95:13,159:5,159:13,0` 
//                 // };
//                 }
//             })
//         }
    
//     }
    
// }

// function disasterTestFlood() {
//     var mapWidth = getMapDimensions()[0];
//     var mapHeight = getMapDimensions()[1];
//     var mapLength = getMapDimensions()[2];
//     console.log(mapLength,mapWidth)
    
//     for (var i = 0; i < mapHeight-5; i++) {
//         let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
        
//         futureActions.push({
//             run: function() {
                
                
//                 runCommand('/tp -5 95 -38')
//                 runCommand('/posa')
//                 runCommand(`/tp -53 95 10`)
//                 runCommand('/posb')
//                 runCommand('/copy')
                
//                 runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[0][1]+dist} ${arenaCorners[0][2]}`)
//                 runCommand('/paste')
//             }
//         })
//     }
// }

// function disasterTestLavaFlood() {
//     var mapWidth = getMapDimensions()[0];
//     var mapHeight = getMapDimensions()[1];
//     var mapLength = getMapDimensions()[2];

//     for (var i = 0; i < mapHeight-5; i++) {
//         let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value

//         futureActions.push({
//             run: function() {


//                 runCommand('/tp -5 97 -38')
//                 runCommand('/posa')
//                 runCommand(`/tp -53 97 10`)
//                 runCommand('/posb')
//                 runCommand('/copy')

//                 runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[0][1]+dist} ${arenaCorners[0][2]}`)
//                 runCommand('/paste')
//             }
//         })
//     }
// }

// function disasterTestLavaFalls() {
//     var mapWidth = getMapDimensions()[0];
//     var mapHeight = getMapDimensions()[1];
//     var mapLength = getMapDimensions()[2];

//     futureActions.push({
//         run: function() {


//             runCommand('/tp -5 97 -38')
//             runCommand('/posa')
//             runCommand(`/tp -53 97 10`)
//             runCommand('/posb')
//             runCommand('/copy')

//             runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
//             runCommand('/paste')
//         }
//     })

// }

const metadataBlocks = {
    'colored': [
        35, // wool
        159, // terracotta
        95, // stained glass
        160 // stained glass pane
    ],
    'wood': [
        5, // planks
        17, // log
        18, // leaves somehow (leaves are ignored until hypixel fixes it)
        126 // slabs
    ],
    'slab': [
        44 // slabs
    ]
}

const metadataMapping = {
    'colored': {
        'color=white': 0,
        'color=orange': 1,
        'color=magenta': 2,
        'color=light_blue': 3,
        'color=yellow': 4,
        'color=lime': 5,
        'color=pink': 6,
        'color=gray': 7,
        'color=light_gray': 8,
        'color=cyan': 9,
        'color=purple': 10,
        'color=blue': 11,
        'color=brown': 12,
        'color=green': 13,
        'color=red': 14,
        'color=black': 15
    },
    'wood': {
        'variant=oak': 0,
        'variant=spruce': 1,
        'variant=birch': 2,
        'variant=jungle': 3,
        'variant=acacia': 4,
        'variant=dark_oak': 5
    },
    'slab': {
        'variant=stone': 0,
        'variant=sandstone': 2,
        'variant=cobblestone': 3,
        'variant=brick': 4,
        'variant=stone_brick': 5,
        'variant=nether_brick': 6,
        'variant=quartz': 7
    }
}

// excludedBlocks are blocks excluded from the array returned in the getMostCommonBlocks function
excludedBlocks = [
    0, // air
    13, // gravel
    12, // sand
    64, // doors
    31, // shrubs
    175, // tall grass
    59, // wheat
    104, // pumpkin stem
    125, // double slabs
    18, // leaves - https://hypixel.net/threads/imadoofus-housing.4861664/
    8, // flowing water
    9, // water
    10, // flowing lava
    11, // lava
    26, // bed
    97, // stone monster egg
]

// this function is helpful for disasters like sinkhole where you want to replace the most common blocks 
function getMostCommonBlocks(x1,y1,z1,x2,y2,z2) {
    var blockCount = {};

    // for proper looping through the blocks
    if (x1 > x2) {
        let temp = x1;
        x1 = x2;
        x2 = temp;
    }

    if (y1 > y2) {
        let temp = y1;
        y1 = y2;
        y2 = temp;
    }

    if (z1 > z2) {
        let temp = z1;
        z1 = z2;
        z2 = temp;
    }

    for (var x = x1; x < x2; x++) {
        for (var y = y1; y < y2; y++) {
            for (var z = z1; z < z2; z++) {
                var block = World.getBlockAt(x,y,z);

                var id = block.getType().getID();

                // continue; if block id is in the excludedBlocks array
                if (excludedBlocks.indexOf(id) !== -1) continue;

                var variant = getBlockVariant(block);

                var protoolId = id;
                if (variant) {
                    protoolId += ':'+variant;
                }

                if (protoolId in blockCount) {
                    blockCount[protoolId]++
                } else {
                    blockCount[protoolId] = 1;
                }
            }
        }
    }
    return blockCount;
}

function getBlockVariant(block) {
    const id = block.getType().getID();
    for (blockType in metadataBlocks) {
        if (metadataBlocks[blockType].indexOf(id) !== -1) {
            var variant = /(color|variant)=([^,\]]+)/.exec(block.getState().toString()) // extracts something like ['variant=oak']
            if (variant) {
                variant = variant[0];
                for(mapping in metadataMapping[blockType]) {
                    if (variant === mapping) {
                        return metadataMapping[blockType][variant];
                    }
                }
            }
        }
    }
}

// teleport the bot to activate redstone that sets the display
function setPlayerDisplay(amount = gameData.playersInArena.length) {
    new Action({
        action: function() {
            const playerCount = amount.toString()
            
            runCommand(`/tp -50 175 ${29-centerBlock(parseInt(playerCount[playerCount.length-1]))}`)

            if (playerCount.length > 1) { // if double digits

                runCommand(`/tp -50 175 ${centerBlock(47-playerCount[0])}`)

            } else {
                runCommand(`/tp -50 175 47.5`)

            }
        }
    })
}

function checkIfGameReady() {
    // return true if there are more than 5 players in the world and if it has been at least 3 seconds since the last game
    if (gameData.playersInHousing.length > 1 && (Date.now() - gameData.lastGameTick) > 1000 * 3) {
        return true;
    }
    return false;
}

// setPlayerDisplay()
function coordsInArea(position1,position2,coords) {
    return  coords[0] < Math.max(position1[0],position2[0]) && coords[0] > Math.min(position1[0],position2[0]) &&
            coords[1] < Math.max(position1[1],position2[1]) && coords[1] > Math.min(position1[1],position2[1]) &&
            coords[2] < Math.max(position1[2],position2[2]) && coords[2] > Math.min(position1[2],position2[2]);
}

function isPlayer(playerMP) {
    // filter out NPC's
    if (playerMP.getUUID().version() !== 4) return false;

    // filter out Hypixel Watchdog
    if (playerMP.getDisplayName().getText() === '') return false;

    return true;
}

function getEntityPos(entity) {
    // return entity position as an array
    return [entity.getX(),entity.getY(),entity.getZ()];
}

function centerBlock(num) {
    // center number to nearest 0.5
    // this took way longer than it should have
    const rem = num % 1;
    if (rem != 0) { // if num is decimal
        return (num < 0 ? Math.floor(num * 2) / 2 : Math.ceil(num * 2) / 2);
    } else {
        return (num < 0 ? Math.floor(num * 2) / 2 + 0.5 : Math.ceil(num * 2) / 2 + 0.5);
    }
}
