'use strict';

const Helpers = require('../helpers.js');
const mochaPlugin = require('serverless-mocha-plugin');

const expect = mochaPlugin.chai.expect;

describe('helpers', () => {

    describe('isset', () => {
        it('should return true for existing variable', () => {
            let variable = {
                child: []
            };
            return expect(Helpers.isset(variable.child)).to.be.true;
        });

        it('should return false for non existing variable', () => {
            let variable = {};
            return expect(Helpers.isset(variable.child)).to.be.false;
        });
    });

    describe('hasTimeWindowPassed', () => {
        it('should return true when time window has passed', () => {
            let date1 = new Date();
            date1.setHours(date1.getHours() - 1);

            return expect(Helpers.hasTimeWindowPassed(date1.toJSON(), 300)).to.be.true;
        });

        it('should return false when time window has not passed', () => {
            let date1 = new Date();
            date1.setHours(date1.getHours() - 1);

            return expect(Helpers.hasTimeWindowPassed(date1.toJSON(), 4000)).to.be.false;
        });
    });

    describe('getRandomElement', () => {
        it('should return one element of list containing two', () => {
            let list = ['element1', 'element2'];
            return expect(list).to.contain(Helpers.getRandomElement(list));
        });
    });

    describe('getKeyByValue', () => {
        it('should return a key using its value', () => {
            let obj = {
                test1: 'abcde',
                test2: 1234
            };
            Object.keys(obj).map(key => {
                expect(key).to.equal(Helpers.getKeyByValue(obj, obj[key]));
            });
        });
    });
});
