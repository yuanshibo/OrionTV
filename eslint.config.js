const { FlatCompat } = require('@eslint/eslintrc');
const path = require('path');
const expo = require('eslint-config-expo');

const compat = new FlatCompat({
    baseDirectory: __dirname,
    resolvePluginsRelativeTo: __dirname,
});

// The new "flat" config format requires an array of config objects
module.exports = [
    // Use the compatibility utility to load the legacy expo config.
    ...compat.extends('expo'),
];
