'use strict';

const AWS = require('aws-sdk');
AWS.config.update({region: 'ap-southeast-2'});
const DynamoDB = new AWS.DynamoDB({apiVersion: '2012-08-10'});

const mochaPlugin = require('serverless-mocha-plugin');
const expect = mochaPlugin.chai.expect;

const TABLE_NAME = 'TrafficLightStates-Test';

const States = require('../states.js')(TABLE_NAME, 'http://localhost');

describe('states', () => {
    before(function() {
        this.timeout(0);

        return DynamoDB
            .createTable({
                AttributeDefinitions: [
                    {
                        AttributeName: 'name',
                        AttributeType: 'S'
                    }
                ],
                KeySchema: [
                    {
                        AttributeName: 'name',
                        KeyType: 'HASH'
                    }
                ],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                },
                TableName: TABLE_NAME
            })
            .promise()
            .then(() => {
                return DynamoDB.waitFor('tableExists', {
                    TableName: TABLE_NAME
                }).promise();
            });
    });

    after(() => {
        return DynamoDB
            .deleteTable({
                TableName: TABLE_NAME
            })
            .promise();
    });

    describe('initiate', () => {
        it('should initiate some states', () => {
            let names = ['test1', 'test2'];
            let initiatedStates = null;

            return States
                .initiate(names, States.STANDBY)
                .then(states => {
                    initiatedStates = states;

                    names.map(name => {
                        expect(initiatedStates).to.include.keys(name);
                        expect(initiatedStates[name]).to.equal(States.STANDBY);
                    });

                    return DynamoDB.batchGetItem({
                        RequestItems: {
                            [TABLE_NAME]: {
                                Keys: names.map(name => ({
                                    name: {
                                        S: name
                                    }
                                }))
                            }
                        }
                    }).promise();
                })
                .then(data => {
                    data.Responses[TABLE_NAME].map(state => {
                        expect(initiatedStates).to.include.keys(state.name.S);
                        expect(initiatedStates[state.name.S]).to.equal(state.state.S);
                    });
                });
        });
    });

    describe('get', () => {
        it('should get an existing state', () => {
            let name = 'test1';

            return States
                .get([name])
                .then(states => expect(states[name]).to.equal(States.STANDBY));
        });

        it('should try to get a non existing state and then create it', () => {
            let name = 'test3';

            return States
                .get([name])
                .then(states => {
                    expect(states[name]).to.equal(States.STANDBY);

                    return DynamoDB.getItem({
                        Key: {
                            name: {
                                S: name
                            }
                        },
                        TableName: TABLE_NAME
                    }).promise();
                })
                .then(data => {
                    expect(data.Item.name.S).to.equal(name);
                    expect(data.Item.state.S).to.equal(States.STANDBY);
                });
        });
    });

    describe('update', () => {
        it('should update a state', () => {
            let name = 'test1';
            let oldState = null;

            return DynamoDB
                .getItem({
                    Key: {
                        name: {
                            S: name
                        }
                    },
                    TableName: TABLE_NAME
                })
                .promise()
                .then(data => {
                    oldState = data.Item.state.S;

                    return States.update([{
                        name: name,
                        state: States.GREEN
                    }]);
                })
                .then(() => DynamoDB.getItem({
                    Key: {
                        name: {
                            S: name
                        }
                    },
                    TableName: TABLE_NAME
                }).promise())
                .then(data => {
                    expect(data.Item.name.S).to.equal(name);
                    expect(data.Item.state.S).to.equal(States.GREEN);
                    expect(data.Item.state.S).to.not.equal(oldState);
                });
        });
    });


});
