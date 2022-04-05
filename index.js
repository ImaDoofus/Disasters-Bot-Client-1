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

const maxChatMessageLength = 100;

var botSelection = {posa: [], posb: []};
var botAreaCopied = {posa: [], posb: []};

const blockLayers = {
    'lava': [[19,159,-8],[-40,159,51]],
    'string': [[19,157,-8],[-40,157,51]],
    'water': [[19,156,-8],[-40,156,51]],
}

const infoDisplays = {
    'donate_a_cookie': [14,174,55],
    'flood': [14,174,56],
    'starting_soon': [14,174,57],
}

const mainDisasters = [
    'flood',
    'lava_rise',
    'blizzard',
    'sandstorm',
    'acid_rain',
    'midas',
    'void',
    'tnt_rain',
    'sinkhole',
]

var disasterVotingWeights = [
    1, // flood
    1, // lava rise
    1, // blizzard
    100, // sandstorm
    1, // acid rain
    1, // midas
    1, // void
    1, // tnt rain
    1, // sinkhole
]

var gameLoop = true;

var gameData = {
    mapSelection: null,
    previousMap: null,
    lastGameTick: null,
    gameTick: 0,
    gameStartTimestamp: null,
    gameRunning: false,
    gameLength: 1000 * 200, // 30 seconds
    playersInHousing: [],
    playersInArena: [],
    disaster: null,
    disasterProgress: 0,
    disasterSpeed: 1,
    disasterStartTimestamp: null,
}

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
    undo: 0,
    copy: 0,
}
const commandCooldownLengths = {
    paste: 5000,
    replace: 5000,
    fill: 5000,
    cut: 5000,
    set: 5000,
    undo: 5000,
    copy: 5000,
}

function init() {
  gameData.mapSelection = getRandomMap();

  for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (typeof button.powered === 'undefined') {
          button.powered = false;
      }
  }
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
            if (commandsToRun[0] !== null) {
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
                    if (type === 'copy') {
                        botAreaCopied.posa = botSelection.posa;
                        botAreaCopied.posb = botSelection.posb;
                    }
                    ChatLib.say(commandsToRun[0].command);
                    console.log(commandsToRun[0].command);
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
            } else { //No-op command
              commandsToRun.shift();
              commandLastRan = Date.now();
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

function runCommand(command, reorder = false, timeout = Infinity, timeoutCallback = defaultCommandTimeoutCallback) {
    commandsToRun.push({command: command, reorder: reorder, timeout: timeout, timeoutCallback: timeoutCallback, pushed: Date.now()});
}

var tickNum = 0;
register('tick', () => {
    tickNum++;

    gameData.playersInArena = 0;
    gameData.playersInHousing = 0;

    // set the amount of players in the arena
    World.getAllPlayers().forEach(player => {
        if (isPlayer(player)) {
            gameData.playersInHousing++;

            if (coordsInArea(arenaCorners[0], arenaCorners[1], getEntityPos(player))) {
                gameData.playersInArena++;
            }
        }
    });

    // go through each button in the buttons and if it was clicked then run the code for the button
    for(var i = 0; i < buttons.length; i++) {
        var button = buttons[i];

        if (/powered=true|power=1|extended=true/.test(World.getBlockAt(...button.location).getState().toString())) { // works for pistons, buttons, pressure plates
            if (button.powered === false) {
                switch (button.name) {
                    case 'vote_flood':
                        disasterVotingWeights[0]++;
                        break;
                    case 'vote_lava_rise':
                        disasterVotingWeights[1]++;
                        break;
                    case 'vote_blizzard':
                        disasterVotingWeights[2]++;
                        break;
                    case 'vote_sandstorm':
                        disasterVotingWeights[3]++;
                        break;
                    case 'vote_acid_rain':
                        disasterVotingWeights[4]++;
                        break;
                    case 'vote_midas':
                        disasterVotingWeights[5]++;
                        break;
                    case 'vote_void':
                        disasterVotingWeights[6]++;
                        break;
                    case 'vote_tnt_rain':
                        disasterVotingWeights[7]++;
                        break;
                    case 'vote_sinkhole':
                        disasterVotingWeights[8]++;
                        break;
                    case 'log_vote_counts':
                        var total = disasterVotingWeights.reduce((a,b) => a + b);
                        disasterVotingWeights.forEach((weight, index) => {
                            ChatLib.chat(`${mainDisasters[index]}: Weight: ${weight} | Percentage: ${Math.round((weight/total)*100*100)/100}%`);
                        });
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

    processActions();

})

function setWeightedRandomDisaster() {
    const cumulativeWeights = [];
    for (let i = 0; i < disasterVotingWeights.length; i++) {
        cumulativeWeights.push(disasterVotingWeights[i] + (cumulativeWeights[i - 1] || 0));
    }
    const maxWeight = cumulativeWeights[cumulativeWeights.length - 1];
    const randomWeight = Math.random() * maxWeight;
    for (let i = 0; i < mainDisasters.length; i++) {
        if (cumulativeWeights[i] >= randomWeight) {
            gameData.disaster = mainDisasters[i];
            break;
        }
    }
}

function getRandomMap() {
    var index = Math.floor(Math.random() * validMaps.length;

    if (index >= validMaps.indexOf(gameData.previousMap)) {
      return validMaps[index + 1];
    } else {
      return validMaps[index]
    }
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
    // loadInfoDisplay('donate_a_cookie');
    resetArena();
    // resetDisplays();
    // setPlayerDisplay(gameData.playersInHousing.length);

    // loadInfoDisplay('starting_soon');
    loadMapTemplate(gameData.mapSelection);
    setWeightedRandomDisaster();
    console.log('Map:',gameData.mapSelection);
    console.log('Disaster:',gameData.disaster);

    const map = maps[gameData.mapSelection];

    // spawnMinecarts();

    // load the maps features
    for (featureSize in map['feature_placements']) {
        map['feature_placements'][featureSize].forEach(featurePosOnTemplate => {
            var randomFeature = getRandomFeature(...featureSize.split('x'));
            if (randomFeature) {
                var pastePos = getFeaturePlacement(gameData.mapSelection,featurePosOnTemplate);
                console.log(featureSize,randomFeature);

                loadFeature(randomFeature,pastePos);
            }
        })
    }

    // loadInfoDisplay('flood');

    // start clock countdown this will start the disasters as well
    startClock()

    gameData.previousMap = gameData.mapSelection;
    // set random map for next game
    gameData.mapSelection = getRandomMap();

    ChatLib.chat('the game has started');
}

function startClock() {
    new Action({
        action: function() {
            runCommand('/tp -45 179 -6')
            gameData.gameTick = 0;
            gameData.disasterStartTimestamp = Date.now();
        }
    })
}

function getFeaturePlacement(mapName,featurePosOnTemplate) {
    const mapOriginX = centerBlock(arenaCorners[0][0]+getMapDepth(mapName)[0]);
    const mapOriginZ = centerBlock(arenaCorners[0][2]+getMapDepth(mapName)[1]);
    const mapOriginY = arenaCorners[0][1]+3;

    const pasteX = mapOriginX+(featurePosOnTemplate[0]-maps[mapName].corners[0][0]);
    const pasteY = mapOriginY+(featurePosOnTemplate[1]-maps[mapName].corners[0][1]);
    const pasteZ = mapOriginZ+(featurePosOnTemplate[2]-maps[mapName].corners[0][2]);

    return [pasteX,pasteY,pasteZ]
}

function loadFeature(featureName,pos) {
    new Action({
        action: function() {

            const feature = features[featureName];

            // copy feature
            selectRegion(feature.corners[0][0],feature.corners[0][1],feature.corners[0][2],feature.corners[1][0],feature.corners[1][1],feature.corners[1][2])
            runCommand('/copy')

            // paste at correct location
            runCommand(`/tp ${centerBlock(pos[0])} ${centerBlock(pos[1])} ${centerBlock(pos[2])}`)
            runCommand('/paste')
            if (features[featureName].double_paste) {
                runCommand(`/tp ${centerBlock(pos[0])} ${pos[1]} ${centerBlock(pos[2])}`)
                runCommand('/paste')
            }
        }
    })
}

function endGame() {
    gameData.gameRunning = false;
    gameData.disasterProgress = 0;
    disasterVotingWeights = disasterVotingWeights.map(weight => 1);
    ChatLib.chat('the game has ended');
}

function gameTick() {
    gameData.lastGameTick = Date.now();
    gameData.gameTick++;

    // per tick logic here e.g. kill players standing on gold

    if (gameData.gameTick % Math.round(100/gameData.disasterSpeed) === 1) { // disaster tick
        switch (gameData.disaster) {
            case 'sinkhole':
                sinkholeTick();
                break;
            case 'midas':
                midasTick();
                break;
            case 'acid_rain':
                acidRainTick();
                break;
            case 'blizzard':
                blizzardTick();
                break;
            case 'void':
                voidTick();
                break;
            case 'flood':
                floodTick('water');
                break;
            case 'lava_rise':
                floodTick('lava');
                break;
            case 'sandstorm':
                sandstormTick();
                break;
        }
        gameData.disasterProgress++
    }

}

function resetDisplays() { // the redstone displays
    new Action({
        action: function() {
            selectRegion(-44,155,-6,-53,172,49);
            runCommand('/copy')

            runCommand(`/tp ${centerBlock(-44)} ${174} ${centerBlock(-6)}`);
            runCommand('/paste')
        }
    })
}

function loadInfoDisplay(id) {
    new Action({
        action: function() {
            const display = infoDisplays[id];
            selectRegion(display[0],display[1],display[2],display[0]-51,display[1]+12,display[2]);
            runCommand('/copy');
            runCommand(`/tp ${centerBlock(15)} ${181} ${centerBlock(53)}`);
            runCommand('/paste');
        }
    })
}

function resetArena() {
    new Action({
        action: function() {
            selectRegion(arenaCorners[0][0],arenaCorners[0][1],arenaCorners[0][2],arenaCorners[1][0],arenaCorners[1][1],arenaCorners[1][2]);
            runCommand('/set 0');
        }
    })
}

function spawnMinecarts() {
    new Action({
        action: function() {

            // copy & paste rails
            selectRegion(15,153,-1,-43,156,61)
            runCommand('/copy');
            runCommand(`/tp ${centerBlock(18)} ${centerBlock(192)} ${centerBlock(-8)}`);
            runCommand('/paste');
            runCommand('/paste');

            // select barriers
            selectRegion(-40,194,52,18,192,-8);

            // spawn in minecarts
            if (Math.random() > 0.5) {
                runCommand(`/tp ${centerBlock(-41)} ${190} ${centerBlock(55)}`); // 66%
            } else {
                runCommand(`/tp ${centerBlock(-41)} ${190} ${centerBlock(61)}`); // 33%
            }

            // 4 sec delay
            runCommand(null);
            runCommand(null);
            runCommand(null);
            runCommand(null);

            // stop minecarts at random points
            runCommand('/replace 166 35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,35,0');
            runCommand('/replace 35 35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,35:1,0');
            runCommand('/replace 35:1 35:2,35:2,35:2,35:2,35:2,35:2,35:2,0');


            // remove everything (drops minecarts)
            runCommand('/set 0');

            // undo everything
            for(var i = 0; i < 6; i++) {
                runCommand('/undo');
            }
        }
    })
}

function loadMapTemplate(mapName) {

    new Action({
        action: function() {

            const map = maps[mapName];
            // copy map
            selectRegion(map.corners[0][0],map.corners[0][1],map.corners[0][2],map.corners[1][0],map.corners[1][1],map.corners[1][2])
            runCommand('/copy')

            // paste the map in the arena (centered)
            const depthWidth = centerBlock(arenaCorners[0][0]+getMapDepth(mapName)[0]);
            const depthLength = centerBlock(arenaCorners[0][2]+getMapDepth(mapName)[1]);
            const depthHeight = arenaCorners[0][1]+3;

            runCommand(`/tp ${depthWidth} ${depthHeight} ${depthLength}`);
            runCommand('/paste')
            runCommand('/paste')
        }
    })
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
    var centerWidth = (-Math.abs(arenaCorners[0][0]-arenaCorners[1][0])/2)+arenaCorners[0][0];
    var centerLength = (Math.abs(arenaCorners[0][2]-arenaCorners[1][2])/2)+arenaCorners[0][2];
    return [centerWidth, centerLength]
}


// --------------------------
// Code for disasters that runs every disaster tick
// --------------------------

function floodTick() {
    var progress = Math.min(gameData.disasterProgress,15);
    new Action({
        action: function() {
            var mapHeight = getMapDimensions()[1];

            // if flood water isn't selected then select it
            if (!samePositions(botSelection.posa,[-53,95,61])) {
                runCommand('/tp '+centerBlock(-53)+' '+95+' '+centerBlock(61));
                runCommand('/pos1')
            }
            if (!samePositions(botSelection.posb,[6,95,2])) {
                runCommand('/tp '+centerBlock(6)+' '+95+' '+centerBlock(2));
                runCommand('/pos2')
            }

            // if flood water isn't copied then copy it
            if (!samePositions(botAreaCopied.posa,[-53,95,61]) || !samePositions(botAreaCopied.posb,[6,95,2])) {
                runCommand('/copy')
            }

            // paste flood water in the arena
            runCommand(`/tp ${centerBlock(arenaCorners[0][0])} ${arenaCorners[0][1]+progress} ${centerBlock(arenaCorners[0][2])}`)
            runCommand('/paste')
        }
    })
}

function sinkholeTick() {
    var progress = Math.min(gameData.disasterProgress,30);
    new Action({
        action: function() {
            var centerX = getArenaCenter()[0];
            var centerZ = getArenaCenter()[1];

            var blockCount = getMostCommonBlocks(centerX+progress,arenaCorners[0][1],centerZ+progress,centerX-progress,arenaCorners[1][1],centerZ-progress);

            var sortedBlockCount = []; // 2 dimensional array [[blockID, count]]
            for (block in blockCount) {
                if (block === '13') continue;
                sortedBlockCount.push([block,blockCount[block]]);
            }
            sortedBlockCount.sort((a,b) => b[1] - a[1]); // sort by count

            if (progress % 4 === 0) { // every 4 blocks out replace everything in the middle with air so center looks more like a hole
                var allBlocks = [];
                for (block in blockCount) {
                    if (block === '13') continue;
                    allBlocks.push(block);
                }
                if (allBlocks.length > 0) {
                    runCommand(`/tp ${centerX+progress-3} ${arenaCorners[0][1]} ${centerZ+progress-3}`)
                    runCommand('/posa')
                    runCommand(`/tp ${centerX-progress+3} ${arenaCorners[1][1]} ${centerZ-progress+3}`)
                    runCommand('/posb')
                    runCommand(`/replace ${allBlocks.join(',').slice(0,maxChatMessageLength-16).replace(/,\s*$/, "")} 13`);
                }
            } else if (sortedBlockCount.length > 0) { // when not every 4 blocks out replace the most common block with 50% gravel
                runCommand(`/tp ${centerX+progress} ${arenaCorners[0][1]} ${centerZ+progress}`)
                runCommand('/posa')
                runCommand(`/tp ${centerX-progress} ${arenaCorners[1][1]} ${centerZ-progress}`)
                runCommand('/posb')
                runCommand(`/replace ${sortedBlockCount[0][0]} ${sortedBlockCount[0][0]},13`);
            }

        }
    })
}

function midasTick() {
    var progress = Math.min(gameData.disasterProgress,30);
    new Action({
        action: function() {
            var centerX = getArenaCenter()[0];
            var centerZ = getArenaCenter()[1];

            var blockCount = getMostCommonBlocks(centerX+progress,arenaCorners[0][1],centerZ+progress,centerX-progress,arenaCorners[1][1],centerZ-progress);
            console.log(progress)

            var allBlocks = [];
            for (block in blockCount) {
                if (block === '41') continue;
                allBlocks.push(block);
            }
            if (allBlocks.length > 0) {
                runCommand(`/tp ${centerX+progress} ${arenaCorners[0][1]} ${centerZ+progress}`)
                runCommand('/posa')
                runCommand(`/tp ${centerX-progress} ${arenaCorners[1][1]} ${centerZ-progress}`)
                runCommand('/posb')
                runCommand(`/replace ${sliceIdList(allBlocks.join(','), maxChatMessageLength-16)} 41`);
            }
        }
    })
}

function acidRainTick() {
    var progress = Math.min(gameData.disasterProgress,arenaCorners[1][1]-arenaCorners[0][1]);
    new Action({
        action: function() {
            console.log(progress)

            var corner1 = [arenaCorners[0][0],arenaCorners[1][1],arenaCorners[0][2]];
            var corner2 = [arenaCorners[1][0],arenaCorners[1][1]-progress,arenaCorners[1][2]];

            var blockCount = getMostCommonBlocks(...corner1, ...corner2);

            var sortedBlockCount = []; // 2 dimensional array [[blockID, count]]

            for (block in blockCount) {
                if (block === '95:5' || block === '95:13') continue;
                sortedBlockCount.push([block,blockCount[block]]);
            }

            sortedBlockCount.sort((a,b) => b[1] - a[1]); // sort by count

            var allBlocks = [];
            for (block in blockCount) {
                allBlocks.push(block);
            }

            if (progress % 4 === 3 && allBlocks.length > 0) { // if more than 0 block types in region & a 4th layer replace all of the blocks in the selection+5 on y-axis with acid
                if (!samePositions(botSelection.posa,corner1)) {
                    runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);
                    runCommand('/posa');
                }
                runCommand(`/tp ${centerBlock(corner2[0])} ${Math.min(corner2[1]+5,arenaCorners[1][1])} ${centerBlock(corner2[2])}`);
                runCommand('/posb');
                runCommand(`/replace ${sliceIdList(allBlocks.join(','), maxChatMessageLength-22)} 95:5,95:13,0`);
            } else if (sortedBlockCount.length > 0) { // if there are more than 20 blocks in region & it is not every 4th layer replace the most common block with 66% acid
                if (!samePositions(botSelection.posa,corner1)) {
                    runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);
                    runCommand('/posa');
                }
                runCommand(`/tp ${centerBlock(corner2[0])} ${corner2[1]} ${centerBlock(corner2[2])}`);
                runCommand('/posb');
                runCommand(`/replace ${sortedBlockCount[0][0]} ${sortedBlockCount[0][0]},95:5,95:13,0`);
            } else {
                // nothing was replaced to acid this layer try on the next layer
                if (gameData.disasterProgress < arenaCorners[1][1]-arenaCorners[0][1]) {
                    gameData.disasterProgress++;
                    acidRainTick();
                }
            }
        }
    })

}

function blizzardTick() {
    var progress = Math.min(gameData.disasterProgress,arenaCorners[1][1]-arenaCorners[0][1]);
    new Action({
        action: function() {
            var corner1 = [arenaCorners[0][0],arenaCorners[1][1],arenaCorners[0][2]];
            var corner2 = [arenaCorners[1][0],arenaCorners[1][1]-progress,arenaCorners[1][2]];

            var blockCount = getMostCommonBlocks(...corner1, ...corner2);

            var sortedBlockCount = []; // 2 dimensional array [[blockID, count]]

            for (block in blockCount) {
                if (block === '79' || block === '80') continue;
                sortedBlockCount.push([block,blockCount[block]]);
            }

            sortedBlockCount.sort((a,b) => b[1] - a[1]); // sort by count

            var allBlocks = [];
            for (block in blockCount) {
                allBlocks.push(block);
            }

            if (progress % 4 === 3 && allBlocks.length > 0) { // if more than 0 block types in region & a 4th layer replace all of the blocks in the selection+5 on y-axis with snow
                if (!samePositions(botSelection.posa,corner1)) {
                    runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);
                    runCommand('/posa');
                }
                runCommand(`/tp ${centerBlock(corner2[0])} ${Math.min(corner2[1]+5,arenaCorners[1][1])} ${centerBlock(corner2[2])}`);
                runCommand('/posb');
                runCommand(`/replace ${allBlocks.join(',').slice(0,maxChatMessageLength-17).replace(/,[^,]*$/, "")} 79,80,0`);
            } else if (sortedBlockCount.length > 0) { // if there are more than 20 blocks in region & it is not every 4th layer replace the most common block with 66% snow
                if (!samePositions(botSelection.posa,corner1)) {
                    runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);
                    runCommand('/posa');
                }
                runCommand(`/tp ${centerBlock(corner2[0])} ${corner2[1]} ${centerBlock(corner2[2])}`);
                runCommand('/posb');
                runCommand(`/replace ${sortedBlockCount[0][0]} ${sortedBlockCount[0][0]},79,80,0`);
            } else {
                // nothing was replaced to snow this layer try on the next layer
                if (gameData.disasterProgress < arenaCorners[1][1]-arenaCorners[0][1]) {
                    gameData.disasterProgress++;
                    blizzardTick();
                }
            }
        }
    })
}

function voidTick() {
    var progress = Math.min(gameData.disasterProgress,arenaCorners[1][1]-arenaCorners[0][1]);
    new Action({
        action: function() {
            var corner1 = [arenaCorners[0][0],arenaCorners[0][1]+progress,arenaCorners[0][2]];
            var corner2 = [arenaCorners[1][0],arenaCorners[0][1]+progress,arenaCorners[1][2]];

            var blockCount = getMostCommonBlocks(...corner1, ...corner2);

            var sortedBlockCount = []; // 2 dimensional array [[blockID, count]]

            for (block in blockCount) {
                sortedBlockCount.push(block);
            }
            sortedBlockCount.sort((a,b) => b[1] - a[1]); // sort by count

            if (progress > 10) {
                if (!samePositions(botSelection.posa,corner1)) {
                    runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);
                    runCommand('/posa');
                }
                runCommand(`/tp ${centerBlock(corner2[0])} ${corner2[1]} ${centerBlock(corner2[2])}`);
                runCommand('/posb');
                runCommand(`/replace ${sortedBlockCount.join(',').slice(0,maxChatMessageLength-12).replace(/,[^,]*$/, "")} 13`);
                runCommand(`/set 0`);
                return;
            }

            selectRegion(...corner1, ...corner2);
            runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);

            if (progress === 0) { // set first layer to coal
                runCommand(`/set 173`);
            } else if (progress === 3) { // set base layer of map to dark glass
                runCommand(`/set 95:15`);
            } else if (progress === 8) {
                runCommand(`/set 95:15`);
            } else if (progress === 9) { // set to string for falling blocks to break
                selectRegion(blockLayers.string[0][0], blockLayers.string[0][1], blockLayers.string[0][2], blockLayers.string[1][0], blockLayers.string[1][1], blockLayers.string[1][2]);
                runCommand(`/copy`);
                runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);
                runCommand(`/paste`);
            } else if (progress === 10) { // set to air for layer 10
                runCommand(`/set 0`);
            } else if (progress % 2 === 0 && progress < 10) { // if even layer & less than 8 set to black glass
                runCommand('/replace 0 95:15');
            } else if (progress % 2 === 1 && progress < 10) { // if odd layer & less than 8 set to dark gray glass
                runCommand('/replace 0 95:7');
            }
        }
    })
}

function floodTick(type) {
    var progress = Math.min(gameData.disasterProgress,arenaCorners[1][1]-arenaCorners[0][1]);
    new Action({
        action: function() {
            var corner1 = [arenaCorners[0][0],arenaCorners[0][1]+progress,arenaCorners[0][2]];

            if (type === 'water' || progress === 0) { // hide lava at bottom of arena
                selectRegion(...corner1, arenaCorners[1][0], arenaCorners[0][1], arenaCorners[1][2]);
                runCommand(`/set lapis_block`);
                return;
            }

            if (!samePositions(botAreaCopied.posa,blockLayers[type][0]) || !samePositions(botAreaCopied.posb,blockLayers[type][1])) {
                selectRegion(blockLayers[type][0][0], blockLayers[type][0][1], blockLayers[type][0][2], blockLayers[type][1][0], blockLayers[type][1][1], blockLayers[type][1][2]);
                runCommand(`/copy`);
            }
            runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);
            runCommand('/paste');
        }
    })
}

function sandstormTick() {
    var progress = Math.min(gameData.disasterProgress,arenaCorners[1][1]-arenaCorners[0][1]);
    new Action({
        action: function() {
            var corner1 = [arenaCorners[0][0],arenaCorners[1][1],arenaCorners[0][2]];
            var corner2 = [arenaCorners[1][0],arenaCorners[1][1]-progress,arenaCorners[1][2]];

            var blockCount = getMostCommonBlocks(...corner1, ...corner2);

            var sortedBlockCount = []; // 2 dimensional array [[blockID, count]]

            for (block in blockCount) {
                if (block === '12' || block === '24') continue;
                sortedBlockCount.push([block,blockCount[block]]);
            }

            sortedBlockCount.sort((a,b) => b[1] - a[1]); // sort by count

            var allBlocks = [];
            for (block in blockCount) {
                allBlocks.push(block);
            }

            if (progress % 4 === 3 && allBlocks.length > 5) { // if more than 5 block types in region & a 4th layer replace all of the blocks in the selection+5 on y-axis with sand
                if (!samePositions(botSelection.posa,corner1)) {
                    runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);
                    runCommand('/posa');
                }
                runCommand(`/tp ${centerBlock(corner2[0])} ${Math.min(corner2[1]+5,arenaCorners[1][1])} ${centerBlock(corner2[2])}`);
                runCommand('/posb');
                runCommand(`/replace ${allBlocks.join(',').slice(0,maxChatMessageLength-17).replace(/,[^,]*$/, "")} 12,24,0`);
            } else if (sortedBlockCount.length > 50) { // if there are more than 50 blocks in region & it is not every 4th layer replace the most common block with 66% sand
                if (!samePositions(botSelection.posa,corner1)) {
                    runCommand(`/tp ${centerBlock(corner1[0])} ${corner1[1]} ${centerBlock(corner1[2])}`);
                    runCommand('/posa');
                }
                runCommand(`/tp ${centerBlock(corner2[0])} ${corner2[1]} ${centerBlock(corner2[2])}`);
                runCommand('/posb');
                runCommand(`/replace ${sortedBlockCount[0][0]} ${sortedBlockCount[0][0]},12,24,0`);
            } else {
                // nothing was replaced to sand this layer so just spawn a layer of sand at the top layer
                selectRegion(arenaCorners[0][0], arenaCorners[1][1], arenaCorners[0][2], arenaCorners[1][0], arenaCorners[1][1], arenaCorners[1][2]);
                runCommand(`/set 12,0,0,0,0`);
            }
        }
    })
}

function tntTick() {} // TODO

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
    ],
    'stone': [
        1, // stone
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
    },
    'stone': {
        'variant=stone': 0,
        'variant=granite': 1,
        'variant=smooth_granite': 2,
        'variant=diorite': 3,
        'variant=smooth_diorite': 4,
        'variant=andesite': 5,
        'variant=smooth_andesite': 6
    }
}

// excludedBlocks are blocks excluded from the array returned in the getMostCommonBlocks function
const excludedBlocks = [
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
    117, // brewing stand
    71, // iron door
    38, // poppy
    140, // flower pot
    43, // double stone slab
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

    for (var x = x1; x <= x2; x++) {
        for (var y = y1; y <= y2; y++) {
            for (var z = z1; z <= z2; z++) {
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

function selectRegion(x1,y1,z1,x2,y2,z2) {
    runCommand(`/tp ${centerBlock(x1)} ${y1} ${centerBlock(z1)}`);
    runCommand('/pos1');
    runCommand(`/tp ${centerBlock(x2)} ${y2} ${centerBlock(z2)}`);
    runCommand('/pos2');
}

function sliceIdList(command, size) {
    if (command.length > size) {
      if (command.charAt(size) === ',') {
        return command.slice(0,size);
      } else {
        return command.slice(0,size).replace(/,[^,]*$/, "");
      }
    } else {
      return command
    }
}

function samePositions(pos1,pos2) {
    // return true if the coords are the same block
    return centerBlock(pos1[0]) === centerBlock(pos2[0]) && centerBlock(pos1[1]) === centerBlock(pos2[1]) && centerBlock(pos1[2]) === centerBlock(pos2[2]);
}

init();
