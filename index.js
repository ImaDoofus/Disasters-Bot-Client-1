/// <reference types="../CTAutocomplete-2.0.4" />
/// <reference lib="es2015" />

const buttons = JSON.parse(FileLib.read('./config/ChatTriggers/modules/HousingBot/housing-data/button-data.json'));
const maps = JSON.parse(FileLib.read('./config/ChatTriggers/modules/HousingBot/housing-data/map-templates.json'));
const features = JSON.parse(FileLib.read('./config/ChatTriggers/modules/HousingBot/housing-data/features.json'));

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

var gameData = {
    mapSelection: 'mario_kart',
    previousMap: null,
    lastActiveGameTimestamp: null,
    playersInHousing: [],
    playersInArena: [],
}

const arenaCorners = [[19.5,160,-7.5],[-40.5,195,52.5]]
const arenaWidth = Math.abs(arenaCorners[0][0]-arenaCorners[1][0]);
const arenaLength = Math.abs(arenaCorners[0][2]-arenaCorners[1][2]);

var futureActions = [];

class Action {
    constructor(data) {
        this.run = data.action;
        futureActions.push(this)
    }
}

// new Action({
//     action: function() {
//         runCommand('/tp -8 187 17')
//         runCommand('/posa')
//         runCommand('/tp -12 187 12')
//         runCommand('/posb')
//         runCommand('/set stone')
//         runCommand('/set lapis_block')
//         runCommand('/set diamond_block')
//         runCommand('/tp imadoofus sirhax',true)
//         runCommand('/tp imadoofus sirhax',true)
//         runCommand('/tp imadoofus sirhax',true)
//         runCommand('/tp imadoofus sirhax',true)
//         runCommand('/tp imadoofus sirhax',true)
//         runCommand('/tp imadoofus sirhax',true)
//         runCommand('/tp imadoofus sirhax',true)
//         runCommand('/tp imadoofus sirhax',true)
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

    if (commandsToRun.length === 0) {
        if (futureActions.length > 0) {
            futureActions[0].run();
            futureActions.shift();
        }
    }

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


    processActions()

})

function resetMap() {

    // Reset Effects
    // runCommand('/setbiome jungle')
    // runCommand('/weather sunny')

    // Clear Map Zone
    runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[0][1]} ${arenaCorners[0][2]}`)
    runCommand('/pos1')
    runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]} ${arenaCorners[1][2]}`)
    runCommand('/pos2')
    runCommand('/set 0')

    // Reset Timer and Player Count
    // runCommand('/tp -33.5 155 9.5')
    // runCommand('/pos1')
    // runCommand('/tp -52.5 172 52.5')
    // runCommand('/pos2')
    // runCommand('/copy')
    // runCommand('/tp -33.5 174 9.5')
    // runCommand('/paste')

}

function loadMapTemplate(mapName) {
    const map = maps[mapName];

    // copy map
    runCommand(`/tp ${map.corners[0].join(' ')}`)
    runCommand('/pos1')
    runCommand(`/tp ${map.corners[1].join(' ')}`)
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

// loadMapTemplate("flat-grass")

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
loadFeature('4x4 test1',[-5, 180, 14+5])
loadFeature('4x4 test2',[-5, 180, 14+10])
loadFeature('4x4 test3',[-5, 180, 14+15])

// function loadMap() {
//     var mapName = gameData.mapSelection;
//     console.log(maps[mapName],mapName)
//     runCommand(`/tp ${maps[mapName].corners[0].join(' ')}`)
//     runCommand('/pos1')
//     runCommand(`/tp ${maps[mapName].corners[1].join(' ')}`)
//     runCommand('/pos2')
//     runCommand('/copy')
    
//     // Find best spot to put the map in the arena so the map is centered.

//     var depthWidth = getMapDepth()[0]
//     var depthLength = getMapDepth()[1];

//     runCommand(`/tp ${arenaCorners[0][0]+depthWidth} ${arenaCorners[0][1]+2} ${arenaCorners[0][2]+depthLength}`)
//     runCommand('/paste')

//     // Teleport players into game
//     World.getAllPlayers().forEach(player => {
//         if (coordsInArea([37,150,63],[-31,196,-9],[player.x,player.y,player.z])) {
//             if (player.name !== 'ImaDoofus') {
//                 if (maps[mapName]['spawn']) {
//                     var spawn = maps[mapName].spawn
//                     runCommand(`/tp ${player.name} ${spawn[0]} ${spawn[1]} ${spawn[2]}`)
//                 } else {
//                     runCommand(`/tp ${player.name} -4.5 180 35`)
//                 }    
//             }
//         }
//     })
//     runCommand(`/tp ${arenaCorners[0][0]+depthWidth+0.5} ${arenaCorners[0][1]+2} ${arenaCorners[0][2]+depthLength+0.5}`)

//     runCommand('/paste')

//     runCommand('/tp -35.5 180 9.5')

//     runCommand(`/tp ${arenaCorners[0][0]+depthWidth} ${arenaCorners[0][1]+2} ${arenaCorners[0][2]+depthLength}`)

// }





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


function disasterTestSinkhole() {
    var centerX = getArenaCenter()[0];
    var centerZ = getArenaCenter()[1];

    for (var i = 0; i < getMapDimensions()[0]/2; i++) {
        let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
        futureActions.push({
            run: function() {
                var blockCount = getMostCommonBlocks(centerX+dist,arenaCorners[0][1],centerZ+dist,centerX-dist,arenaCorners[1][1],centerZ-dist);

                var sortable = [];

                for (block in blockCount) {
                    if (block === '13') continue;
                    sortable.push([block,blockCount[block]]);
                }

                sortable.sort(function(a,b) {
                    return a[1] - b[1];
                })

                console.log(JSON.stringify(sortable))
                while (sortable.length > 0 && sortable[sortable.length-1][1] > dist * 8) {
                    console.log(sortable[sortable.length-1][0])
                    runCommand(`/tp ${centerX+dist} ${arenaCorners[0][1]} ${centerZ+dist}`)
                    runCommand('/posa')
                    runCommand(`/tp ${centerX-dist} ${arenaCorners[1][1]} ${centerZ-dist}`)
                    runCommand('/posb')
                    runCommand(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},gravel`);
                    sortable.pop();
                }

                var uncommon = [];

                for (block in sortable) {
                    if (block[1] < dist * 2) {
                        uncommon.push(block[0]);
                    }
                }

                if (dist % 4 === 0) {
                    if (uncommon.length > 0) {
                        runCommand(`/tp ${centerX+dist} 156 ${centerZ+dist}`)
                        runCommand('/posa')
                        runCommand(`/tp ${centerX-dist} 190 ${centerZ-dist}`)
                        runCommand('/posb')
                        runCommand(`/replace ${uncommon.join(',')} ${uncommon.join(',')},gravel`);
                    }
                }

            }
        })
    }
}

function disasterTestAcidRain() {
    runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`);
    runCommand('/posa');

    for (var i = 0; i < 15; i++) {
        let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value

        new Action({
            action: function() {

                var blockCount = getMostCommonBlocks(arenaCorners[0][0],arenaCorners[1][1],arenaCorners[0][2],arenaCorners[1][0],arenaCorners[1][1]-dist,arenaCorners[1][2]);
                // console.log(JSON.stringify(blockCount))

                var sortable = [];

                for (block in blockCount) {
                    if (block === '95:5' || block === '95:13') continue;
                    sortable.push([block,blockCount[block]]);
                }

                sortable.sort(function(a,b) {
                    return a[1] - b[1];
                })

                for (var j = 0; j < 1; j++) {
                    if (sortable.length > 0) {
                        runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`);
                        runCommand('/posb');
                        runCommand(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},95:5,95:13,0`);
                        console.log(sortable[sortable.length-1][0]);
                    }
                    sortable.pop();
                }

                // Every 4 blocks remove the uncommon blocks

                var uncommon = [];

                for (block in sortable) {
                    if (block[1] < 30) {
                        uncommon.push(block[0]);
                    }
                }

                // console.log('BLOCK COUNTS: '+JSON.stringify(blockCount))

                // if (dist % 4 === 0) {
                //     if (uncommon.length > 0) {
                //         runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
                //         runCommand('/posa')
                //         runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
                //         runCommand('/posb')
                //         runCommand(`/replace ${uncommon.join(',')},95:5,95:13 95:5,95:13,0,0,0,0,0,0,0,0`);
                //     }
                // }

            }
        })
    }

}

function disasterTestBlizzard() {
    runCommand('/weather raining')
    runCommand('/setbiome cold_taiga')

    for (var i = 0; i < 39; i++) {
        let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value

        futureActions.push({
            run: function() {
                var blockCount = getMostCommonBlocks(arenaCorners[0][0],arenaCorners[1][1],arenaCorners[0][2],arenaCorners[1][0],arenaCorners[1][1]-dist,arenaCorners[1][2]);
                // console.log(JSON.stringify(blockCount))

                var sortable = [];

                for (block in blockCount) {
                    if (block === '80:' || block === '79:' || block === '174:') continue;
                    sortable.push([block,blockCount[block]]);
                }

                sortable.sort(function(a,b) {
                    return a[1] - b[1];
                })

                for (var j = 0; j < 2; j++) {
                    if (sortable.length > 0) {
                        runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`);
                        runCommand('/posa');
                        runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`);
                        runCommand('/posb');
                        runCommand(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},80`);
                        console.log(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},80`);
                    }
                    sortable.pop();
                }

                // Every 4 blocks remove the uncommon blocks

                var uncommon = [];

                for (block in sortable) {
                    if (block[1] < 30) {
                        uncommon.push(block[0]);
                    }
                }

                // console.log('BLOCK COUNTS: '+JSON.stringify(blockCount))

                if (dist % 4 === 0) {
                    if (uncommon.length > 0) {
                        runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
                        runCommand('/posa')
                        runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
                        runCommand('/posb')
                        runCommand(`/replace ${uncommon.join(',')},80,79,174 80,79,174,0,0,0,0`);
                    }
                }

                // if (Object.keys(blockCount).length !== 0) {

                //     var max = Object.keys(blockCount).reduce((a, b) => blockCount[a] > blockCount[b] ? a : b);
        
                //     // console.log(max)
                //     runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
                //     runCommand('/posa')
                //     runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
                //     runCommand('/posb')
                //     runCommand(`/replace ${max},95:5,95:13 ${max},95:5,95:13,0,0,0`);
                //     console.log(max)
                //     // `/replace ${max},95:5,95:13,159:5,159:13 ${max},${max},${max},${max},${max},95:5,95:13,159:5,159:13,0` 
                // };
            }
        })
    }
}

function disasterTestSandstorm() {
    runCommand('/setbiome desert')

    for (var k = 0; k < 1; k++) {
        for (var i = 0; i < 39; i++) {
            let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
    
            futureActions.push({
                run: function() {
                    var blockCount = getMostCommonBlocks(arenaCorners[0][0],arenaCorners[1][1],arenaCorners[0][2],arenaCorners[1][0],arenaCorners[1][1]-dist,arenaCorners[1][2]);
                    // console.log(JSON.stringify(blockCount))
    
                    var sortable = [];
    
                    for (block in blockCount) {
                        if (block === '12:' || block === '24:') continue;
                        sortable.push([block,blockCount[block]]);
                    }
    
                    sortable.sort(function(a,b) {
                        return a[1] - b[1];
                    })
    
                    for (var j = 0; j < 1; j++) {
                        if (sortable.length > 0) {
                            runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`);
                            runCommand('/posa');
                            runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`);
                            runCommand('/posb');
                            runCommand(`/replace ${sortable[sortable.length-1][0]} ${sortable[sortable.length-1][0]},12`);

                        }
                        sortable.pop();
                    }
    
                    // Every 4 blocks remove the uncommon blocks
    
                    var uncommon = [];
    
                    for (block in sortable) {
                        if (block[1] < 30) {
                            uncommon.push(block[0]);
                        }
                    }
    
                    // console.log('BLOCK COUNTS: '+JSON.stringify(blockCount))
    
                    if (dist % 4 === 0) {
                        if (uncommon.length > 0) {
                            runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
                            runCommand('/posa')
                            runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
                            runCommand('/posb')
                            runCommand(`/replace ${uncommon.join(',')},12,24 12,24,0,0,`);
                            runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`);
                            runCommand('/posa');
                            runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]} ${arenaCorners[1][2]}`);
                            runCommand('/posb');
                            runCommand(`/replace 0 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12`);
                        }
                    }
    
                    // if (Object.keys(blockCount).length !== 0) {
    
                    //     var max = Object.keys(blockCount).reduce((a, b) => blockCount[a] > blockCount[b] ? a : b);
            
                    //     // console.log(max)
                    //     runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
                    //     runCommand('/posa')
                    //     runCommand(`/tp ${arenaCorners[1][0]} ${arenaCorners[1][1]-dist} ${arenaCorners[1][2]}`)
                    //     runCommand('/posb')
                    //     runCommand(`/replace ${max},95:5,95:13 ${max},95:5,95:13,0,0,0`);
                    //     console.log(max)
                    //     // `/replace ${max},95:5,95:13,159:5,159:13 ${max},${max},${max},${max},${max},95:5,95:13,159:5,159:13,0` 
                    // };
                }
            })
        }
    
    }

}


function disasterTestFlood() {
    var mapWidth = getMapDimensions()[0];
    var mapHeight = getMapDimensions()[1];
    var mapLength = getMapDimensions()[2];
    console.log(mapLength,mapWidth)

    for (var i = 0; i < mapHeight-5; i++) {
        let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value

        futureActions.push({
            run: function() {


                runCommand('/tp -5 95 -38')
                runCommand('/posa')
                runCommand(`/tp -53 95 10`)
                runCommand('/posb')
                runCommand('/copy')

                runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[0][1]+dist} ${arenaCorners[0][2]}`)
                runCommand('/paste')
            }
        })
    }
}

function disasterTestLavaFlood() {
    var mapWidth = getMapDimensions()[0];
    var mapHeight = getMapDimensions()[1];
    var mapLength = getMapDimensions()[2];

    for (var i = 0; i < mapHeight-5; i++) {
        let dist = i; // https://dzone.com/articles/why-does-javascript-loop-only-use-last-value

        futureActions.push({
            run: function() {


                runCommand('/tp -5 97 -38')
                runCommand('/posa')
                runCommand(`/tp -53 97 10`)
                runCommand('/posb')
                runCommand('/copy')

                runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[0][1]+dist} ${arenaCorners[0][2]}`)
                runCommand('/paste')
            }
        })
    }
}

function disasterTestLavaFalls() {
    var mapWidth = getMapDimensions()[0];
    var mapHeight = getMapDimensions()[1];
    var mapLength = getMapDimensions()[2];

    futureActions.push({
        run: function() {


            runCommand('/tp -5 97 -38')
            runCommand('/posa')
            runCommand(`/tp -53 97 10`)
            runCommand('/posb')
            runCommand('/copy')

            runCommand(`/tp ${arenaCorners[0][0]} ${arenaCorners[1][1]} ${arenaCorners[0][2]}`)
            runCommand('/paste')
        }
    })

}


const colorMapping = {
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
}

const variantMapping = {
    'variant=oak': 0,
    'variant=spruce': 1,
    'variant=birch': 2,
    'variant=jungle': 3,
    'variant=acacia': 4,
    'variant=dark_oak': 5
}

const slabMapping = {
    'variant=stone': 0,
    'variant=sandstone': 2,
    'variant=cobblestone': 3,
    'variant=brick': 4,
    'variant=stone_brick': 5,
    'variant=nether_brick': 6,
    'variant=quartz': 7
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

function getMostCommonBlocks(x1,y1,z1,x2,y2,z2) {
    var blockCount = {};

    for (var x = 0; x < Math.abs(x1-x2); x++) {
        for (var y = 0; y < Math.abs(y1-y2); y++) {
            for (var z = 0; z < Math.abs(z1-z2); z++) {
                var block = World.getBlockAt(x1+Math.sign(x2-x1)*x,y1+Math.sign(y2-y1)*y,z1+Math.sign(z2-z1)*z)
                // console.log(x1+Math.sign(x2-x1)*x,y1+Math.sign(y2-y1)*y,z1+Math.sign(z2-z1)*z)
                
                // check if block id is in the excludedBlocks array
                if (excludedBlocks.indexOf(block.getType().getID()) == -1) continue;

                var blockColor = '';
                var blockVariant = '';

                if (block.getType().getID() === 35 || block.getType().getID() === 159 || block.getType().getID() === 95 || block.getType().getID() === 160 ) {
                    for(color in colorMapping) {
                        var metadata = block.getState().toString().match(/\[(.*?)\]/)
                        if (metadata) {
                            if (metadata[1].includes(color)) {
                                blockColor = colorMapping[color];
                                break;
                            }
                        }
                    }
                }

                if (block.getType().getID() === 5 || block.getType().getID() === 17 || block.getType().getID() === 18 || block.getType().getID() === 126) {
                    for(variant in variantMapping) {
                        var metadata = block.getState().toString().match(/\[(.*?)\]/)
                        if (metadata) {
                            if (metadata[1].includes(variant)) {
                                blockVariant = variantMapping[variant];
                                break;
                            }
                        }
                    }    
                }

                if (block.getType().getID() === 44) {
                    for(slab in slabMapping) {
                        var metadata = block.getState().toString().match(/\[(.*?)\]/)

                        if (metadata) {
                            if (metadata[1].includes(slab)) {
                                blockVariant = slabMapping[slab];
                                break;
                            }
                        }
                    }    
                }
                
                var protoolSafe = block.getType().getID()+':'+blockColor+blockVariant;
                if (protoolSafe in blockCount) {
                    blockCount[protoolSafe]++
                } else {
                    blockCount[protoolSafe] = 1;
                }
            }
        }
    }
    return blockCount;
}

// console.log(JSON.stringify(getMostCommonBlocks(-7,182,42,-10,183,45)))

function setPlayerDisplay() {
    World.getAllPlayers().forEach(player => {
        var totalInArea = 0;
        if (coordsInArea(arenaCorners[0],arenaCorners[1],[player.x,player.y,player.z])) {
            totalInArea++;
        }
        playerCount = totalInArea.toString();
        
    })
}

// function checkIfGameReady() {
//     // return true if there are more than 5 players in the world and if it has been at least 30 seconds since the last game

//     if (World.getAllPlayers().length > 5 && (Date.now() - lastGameStart) > 30000) {
//         return true;
//     }
//     return false;


// }

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

// function coordsInArea(a,b,c) {
//     var maxX = Math.max(a[0],b[0]);
//     var maxY = Math.max(a[1],b[1]);
//     var maxZ = Math.max(a[2],b[2]);
//     var minX = Math.min(a[0],b[0]);
//     var minY = Math.min(a[1],b[1]);
//     var minZ = Math.min(a[2],b[2]);
//     // console.log(c[0] < maxX,c[0] > minX,c[1] < maxY, c[1] > minY, c[2] < maxZ, c[2] > minZ)

//     return c[0] < maxX && c[0] > minX && c[1] < maxY && c[1] > minY && c[2] < maxZ && c[2] > minZ;
// }


// console.log(new Sign(World.getBlockAt(44,188,34)).getUnformattedLines()[0])
// console.log(new Sign(World.getBlockAt(44,188,34)).getUnformattedLines()[1])
// console.log(new Sign(World.getBlockAt(44,188,34)).getUnformattedLines()[2])
// console.log(new Sign(World.getBlockAt(44,188,34)).getUnformattedLines()[3])