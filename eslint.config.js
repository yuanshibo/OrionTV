/* eslint-env node */
const { FlatCompat } = require('@eslint/eslintrc');
const path = require('path');
const expo = require('eslint-config-expo');

const compat = new FlatCompat({
    // eslint-disable-next-line no-undef
    baseDirectory: __dirname,
    // eslint-disable-next-line no-undef
    resolvePluginsRelativeTo: __dirname,
});

// The new "flat" config format requires an array of config objects
module.exports = [
    // Use the compatibility utility to load the legacy expo config.
    ...compat.extends('expo'),
];
