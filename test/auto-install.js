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
console.log = function(){};

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
      missing: [{files:['index.js'], name: 'koa-route'}],
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
        installed: [{name: 'koa-route', files: ['index.js']}],
        uninstalled: ['co'],
        missing: [],
        unused: []
      });
      fs.statSync(path.join(TMP_PROJ, 'node_modules', 'koa-route'));
      try{
        fs.statSync(path.join(TMP_PROJ, 'node_modules', 'co'));
        throw new Error('co not uninstalled');
      }catch(e){}
    });
  });
});
