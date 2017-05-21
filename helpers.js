'use strict';

const isset = variable => {
    return typeof variable !== 'undefined';
};

const hasTimeWindowPassed = (pastDate, timeWindow) => {
    return ((new Date()).getTime() - (new Date(pastDate)).getTime() >= timeWindow * 1000);
};

const getRandomElement = (list) => {
    let max = list.length - 1;
    return list[getRandomInt(0, max)];
};

const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};

const getKeyByValue = (obj, value) => {
    let foundKey = null;

    Object.keys(obj).map(key => {
        if(obj[key] === value)
            foundKey = key;
    });

    return foundKey;
};

const sendSuccess = (callback, updatedStates) => {
    callback(null, {
        success: true,
        updatedStates: updatedStates
    });
};

const sendError = (callback, message) => {
    callback(null, {
        success: false,
        errorMessage: message
    });
};

module.exports = {
    isset: isset,
    hasTimeWindowPassed: hasTimeWindowPassed,
    getRandomElement: getRandomElement,
    getKeyByValue: getKeyByValue,
    sendSuccess: sendSuccess,
    sendError: sendError
};
