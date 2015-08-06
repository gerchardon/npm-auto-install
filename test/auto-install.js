var AutoInstall = require('../lib/');
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
var should = chai.should();
var assert = chai.assert;
var expect = chai.expect;
var fs = require('fs');
var fse = require('fs-extra');
var path = require('path');

chai.use(chaiAsPromised);


var TMP_PROJ = 'test/data/tmp/';

var oldConsoleLog = console.log;
function disableLog(){
 console.log = function(){};
}
function enableLog(){
  console.log = oldConsoleLog;
}

beforeEach(function() {
  disableLog();
  try{
    fse.removeSync(TMP_PROJ);
  }catch(e){}
});

afterEach(function() {
  enableLog();
});

describe('CheckPackage', function () {
  it('detectMissing', function() {
    var expected = {
      installed: [], uninstalled: [],
      missing: [{files:['index.js'], name: 'colors'}],
      unused: ['co']
    };
    return new AutoInstall().detectMissing("test/data/project1/").then(function(data) {
      data.should.deep.equal(expected);
    });
  });

  it('package.json missing', function(){
    return new AutoInstall().detectMissing("test/data/unknow/").then(function(){
      throw new Error('need to send error when project missing');
    }, function(err){});
  });

  it('install and uninstall', function(){
    fse.copySync('test/data/templateProject2', TMP_PROJ);
    return new AutoInstall().detectMissing(TMP_PROJ, {install: true, force: true, uninstall: true}).then(function(data){
      data.should.deep.equal({
        installed: [{name: 'colors', files: ['index.js']}],
        uninstalled: ['co'],
        missing: [],
        unused: []
      });
      fs.statSync(path.join(TMP_PROJ, 'node_modules', 'colors'));
      try{
        fs.statSync(path.join(TMP_PROJ, 'node_modules', 'co'));
        throw new Error('co not uninstalled');
      }catch(e){}
    });
  });

  it('check good project', function(){
    return new AutoInstall().detectMissing('test/data/project3', {install: true, force: true, uninstall: true}).then(function(data){
      data.should.deep.equal({
        installed: [], uninstalled: [], missing: [], unused: []
      });
    });
  });

  it('only install', function(){
    fse.copySync('test/data/project1', TMP_PROJ);
    return new AutoInstall().detectMissing(TMP_PROJ, {install: true, force: true}).then(function(data){
      data.should.deep.equal({
        installed: [{files:['index.js'], name: 'colors'}], uninstalled: [],
        missing: [],
        unused: ['co']
      });
    });
  });

  it('only uninstall', function(){
    fse.copySync('test/data/project1', TMP_PROJ);
    return new AutoInstall().detectMissing(TMP_PROJ, {uninstall: true, force: true}).then(function(data){
      data.should.deep.equal({
        installed: [], uninstalled: ['co'],
        missing: [{files:['index.js'], name: 'colors'}],
        unused: []
      });
    });
  });

  it('no uninstall', function(){
    fse.copySync('test/data/projectMissing', TMP_PROJ);
    return new AutoInstall().detectMissing(TMP_PROJ, {install: true, uninstall: true, force: true}).then(function(data){
      data.uninstalled.should.deep.equal([]);
    });
  });
});
