'use strict';

const AWS = require('aws-sdk');
const Lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

const TRAFFIC_LIGHTS_TABLE = 'TrafficLightStates';

const TRAFFIC_LIGHT_START = 'startDate';
const TRAFFIC_LIGHT_LAST_UPDATED = 'lastUpdatedDate';
const TRAFFIC_LIGHT_NAMES = ['lightNS', 'lightEW'];
const TRAFFIC_LIGHT_TOPIC = '/updates';

const Helpers = require('./helpers.js');
const States = require('./states.js')(TRAFFIC_LIGHTS_TABLE, 'a3ivpzd5kfzxtz.iot.ap-southeast-2.amazonaws.com');

const recurseFunction = (functionName, payload) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            Lambda
                .invoke({
                    FunctionName: functionName,
                    InvocationType: "Event",
                    Payload: JSON.stringify(payload)
                })
                .promise()
                .then(data => resolve(data))
                .catch(err => reject(err));
        }, 2000);
    });
};

module.exports.startSimulation = (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;

    let configs = Object.assign({
        greenPeriod: 300,
        yellowPeriod: 30,
        simulationPeriod: 1800
    }, event);

    let allStateNames = TRAFFIC_LIGHT_NAMES.concat([TRAFFIC_LIGHT_START, TRAFFIC_LIGHT_LAST_UPDATED]);

    States.get(allStateNames)
        .then(states => {
            // CHECK IF NOT FORCED OFF
            if(states[TRAFFIC_LIGHT_START] !== States.OFF) {
                // START SIMULATION
                if (states[TRAFFIC_LIGHT_START] === States.STANDBY) {
                    let lightToTurnGreen = Helpers.getRandomElement(TRAFFIC_LIGHT_NAMES);

                    let newStates = TRAFFIC_LIGHT_NAMES.map(light => ({
                        name: light,
                        state: lightToTurnGreen === light ? States.GREEN : States.RED
                    }));

                    let currentDate = new Date();
                    newStates.push(
                        {
                            name: TRAFFIC_LIGHT_START,
                            state: currentDate.toJSON()
                        },
                        {
                            name: TRAFFIC_LIGHT_LAST_UPDATED,
                            state: currentDate.toJSON()
                        }
                    );

                    States.update(newStates)
                        .then(() => States.publish(TRAFFIC_LIGHT_TOPIC, newStates))
                        .then(() => recurseFunction(context.functionName, configs))
                        .then(() => {
                            console.log(newStates);
                            Helpers.sendSuccess(callback, newStates);
                        })
                        .catch(err => {
                            console.log(err);
                            Helpers.sendError(callback, 'Error while starting the simulation');
                        });
                // KEEP RUNNING SIMULATION
                } else if (!Helpers.hasTimeWindowPassed(states[TRAFFIC_LIGHT_START], configs.simulationPeriod)) {
                    let newStates = null;
                    let timeWindow = null;

                    // Change the GREEN light to YELLOW
                    let greenLight = Helpers.getKeyByValue(states, States.GREEN);
                    if (greenLight !== null) {
                        newStates = [
                            {
                                name: greenLight,
                                state: States.YELLOW
                            }
                        ];

                        timeWindow = configs.greenPeriod;
                        // Change the YELLOW light to RED, and the RED light to GREEN
                    } else {
                        newStates = [
                            {
                                name: Helpers.getKeyByValue(states, States.YELLOW),
                                state: States.RED
                            },
                            {
                                name: Helpers.getKeyByValue(states, States.RED),
                                state: States.GREEN
                            }
                        ];

                        timeWindow = configs.yellowPeriod;
                    }

                    // Proceed with update or leave it to next run
                    if (Helpers.hasTimeWindowPassed(states[TRAFFIC_LIGHT_LAST_UPDATED], timeWindow)) {
                        newStates.push({
                            name: TRAFFIC_LIGHT_LAST_UPDATED,
                            state: (new Date()).toJSON()
                        });

                        States.update(newStates)
                            .then(() => States.publish(TRAFFIC_LIGHT_TOPIC, newStates))
                            .then(() => recurseFunction(context.functionName, configs))
                            .then(() => {
                                console.log(newStates);
                                Helpers.sendSuccess(callback, newStates);
                            })
                            .catch(err => {
                                console.log(err);
                                Helpers.sendError(callback, 'Error while updating light states during simulation');
                            });
                    } else {
                        recurseFunction(context.functionName, configs)
                            .then(() => {
                                console.log('Nothing to do, just recursing');
                                Helpers.sendSuccess(callback, {});
                            })
                            .catch(err => {
                                console.log(err);
                                Helpers.sendError(callback, 'Failed recursing');
                            });
                    }
                // END SIMULATION
                } else {
                    let newStates = allStateNames.map(name => ({
                        name: name,
                        state: States.STANDBY
                    }));

                    States.update(newStates)
                        .then(() => States.publish(TRAFFIC_LIGHT_TOPIC, newStates))
                        .then(() => {
                            console.log(newStates);
                            Helpers.sendSuccess(callback, newStates);
                        })
                        .catch(err => {
                            console.log(err);
                            Helpers.sendError(callback, 'Error while ending the simulation');
                        });
                }
            } else {
                // Update startDate in DynamoDB to 'standby'
                console.log('Under maintenance');
                Helpers.sendError(callback, 'Simulation is under maintenance, contact operator');
            }
        })
        .catch(err => {
            console.log(err);
            Helpers.sendError(callback, 'Failed retrieving or initiating the states');
        });
};