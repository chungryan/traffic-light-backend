'use strict';

const AWS = require('aws-sdk');
AWS.config.update({region: 'ap-southeast-2'});
const DynamoDB = new AWS.DynamoDB({apiVersion: '2012-08-10'});
const Helpers = require('./helpers.js');

const OFF = 'off';
const STANDBY = 'standby';
const GREEN = 'green';
const YELLOW = 'yellow';
const RED = 'red';

const States = (tableName, iotEndpoint) => {
    let fn = {
        OFF: OFF,
        STANDBY: STANDBY,
        GREEN: GREEN,
        YELLOW: YELLOW,
        RED: RED
    };

    fn.initiate = (names, initialState) => {
        return new Promise((resolve, reject) => {
            let states = {};
            names.map(name => states[name] = initialState);

            DynamoDB.batchWriteItem({
                RequestItems: {
                    [tableName]: Object.keys(states).map(name => {
                        return {
                            PutRequest: {
                                Item: {
                                    name: {
                                        S: name
                                    },
                                    state: {
                                        S: states[name]
                                    }
                                }
                            }
                        };
                    })
                }
            }, (err, data) => {
                if(err) {
                    reject(err);
                } else if(!Helpers.isset(data.UnprocessedItems) || data.UnprocessedItems.length > 0) {
                    reject('Error while initiating states');
                } else {
                    resolve(states);
                }
            });
        });
    };

    fn.get = (names) => {
        return new Promise((resolve, reject) => {
            let keys = names.map(name => ({
                name: {
                    S: name
                }
            }));

            DynamoDB.batchGetItem({
                RequestItems: {
                    [tableName]: {
                        Keys: keys,
                        ProjectionExpression: '#N, #S',
                        ExpressionAttributeNames: {
                            '#N': 'name',
                            '#S': 'state'
                        }
                    }
                }
            }, (err, data) => {
                if(err) {
                    reject(err);
                } else if(!Helpers.isset(data.Responses) || !Helpers.isset(data.Responses[tableName]) || data.Responses[tableName].length !== keys.length) {
                    fn.initiate(names, STANDBY)
                        .then(data => resolve(data))
                        .catch(err => reject(err));
                } else {
                    let states = {};

                    data.Responses[tableName].map(item => {
                        states[item.name.S] = item.state.S;
                    });

                    resolve(states);
                }
            })
        });
    };

    fn.update = (newStates) => {
        return Promise.all(newStates.map(state => DynamoDB.updateItem({
            ExpressionAttributeNames: {
                '#S': 'state'
            },
            ExpressionAttributeValues: {
                ':s': {
                    S: state.state
                }
            },
            Key: {
                name: {
                    S: state.name
                }
            },
            ReturnValues: 'NONE',
            TableName: tableName,
            UpdateExpression: "SET #S = :s"
        }).promise()));
    };

    fn.publish = (topic, states) => {
        const IotData = new AWS.IotData({
            endpoint: iotEndpoint,
            apiVersion: '2015-05-28'
        });

        return IotData.publish({
            topic: topic,
            payload: JSON.stringify(states),
            qos: 1
        }).promise();
    };

    return fn;
};

module.exports = States;