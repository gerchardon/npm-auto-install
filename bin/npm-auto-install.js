#!/usr/bin/env node
// -*- mode: Javascript; -*-
"use strict";
process.bin = process.title = "ncp";

var colors = require('colors/safe');
// var colors = require('colors');
var program = require('commander');
var _ = require('lodash');
program
  .version(require('../package').version);
program
  .option('-v, --verbose', 'Verbose mode')
  .option('-i, --install', 'Install missing package')
  .option('-u, --uninstall', 'Uninstall unused package')
  .option('-f, --force', 'Force to install or uninstall');

program
  .parse(process.argv);

var AutoInstall = require('../lib/');
var options = {};
if(program.install) {
  options.install = true;
}
if(program.uninstall) {
  options.uninstall = true;
}
if(program.force) {
  options.force = true;
}

new AutoInstall().detectMissing(process.cwd(), options).then(function(errors){
  errors.installed.forEach(function(e){
    console.log(colors.green('installed : %s'), e.name);
  });
  errors.uninstalled.forEach(function(e) {
    console.log(colors.green('uninstalled : %s'), e);
  });
  errors.missing.forEach(function(e) {
    console.log(colors.red('missing : %s (%s)'), e.name, e.files);
  });
  errors.unused.forEach(function(e) {
    console.log(colors.yellow('unused : %s'), e);
  });

  if(!_.isEmpty(errors.missing) || !_.isEmpty(errors.unused)){
    process.exit(1);
  }
}).catch(function(err){
  console.log(colors.red(err.message));
  console.log(err.stack);
  process.exit(2);
});
