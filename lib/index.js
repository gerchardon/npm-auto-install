var debug = require('debug')('ncp:index'),
    glob = require("glob"),
    fs = require("fs"),
    path = require("path"),
    _ = require('lodash');

var systemPackages = ['fs', 'path', 'child_process'];

function AutoInstall(){}


function loadNaiConfig(directory){
  var ret = {};
  try{
    ret = JSON.parse(fs.readFileSync(path.resolve(directory, './.nairc')));
  }catch(ex){}
  return ret;
}


/**
 * Find object like :
 *   type: CallExpression
 *   callee:
 *     name: require
 *
 */
function findRequire(obj) {
  if(obj===null) return [];
  if(typeof obj === 'object'){
    if (obj.type && obj.type === 'CallExpression' && obj.callee.name === 'require'){
      var req = obj.arguments[0].value;
      if(!/^\./.test(req) && req!==undefined){
        // Dont handle dynamic require
        return [req.split('/')[0]];
      }
    } else {
      var ret = [];
      Object.keys(obj).forEach(function(k) {
        var temp = findRequire(obj[k]);
        ret = _.union(ret, temp);
      });
      return ret;
    }
  }
  return [];
}

/**
 * npm loaded and packageName to install
 */
function installPackages(npm, names) {
  return new Promise(function(resolve, reject){
    if(!_.isEmpty(names)){
      debug('install npm package', names);
      npm.commands.install(names, function(err, data){
        if(err) reject(err);
        resolve(data);
      });
    }else{
      resolve([]);
    }
  });
}

function uninstallPackages(npm, names) {
  return new Promise(function(resolve, reject){
    if(!_.isEmpty(names)) {
      debug('uninstall npm package', names);
      npm.commands.uninstall(names, function(err, data){
        debug('uninstall result', err, data);
        if(err) reject(err);
        resolve(data);
      });
    }else{
      resolve([]);
    }
  });
}

function launchInstallUninstall(npm, options, ret) {
  var installPromise = null;
  var uninstallPromise = null;
  if(options.install){
    installPromise = installPackages(npm, _.map(ret.missing, function(d){ return d.name; })).then(function(){
      ret.installed = ret.missing;
      ret.missing = [];
    });
  }
  if(options.uninstall){
    uninstallPromise = uninstallPackages(npm, ret.unused).then(function(){
      ret.uninstalled = ret.unused;
      ret.unused = [];
    });
  }
  return Promise.all([installPromise, uninstallPromise]).then(function(){
    return ret;
  });
}


function npmLoad(npm, directory){
  return new Promise(function(resolve, reject) {
    npm.load({silent: true, global: false}, function(err){
      if(err) reject(err);
      npm.config.set('save', true);
      npm.localPrefix = directory;
      resolve();
    });
  });
}

AutoInstall.prototype.detectMissing = function(directory, options) {
  // return Promise.resolve({installed:[], uninstalled:[], unused:[], missing:[]});
  return new Promise(function (resolve, reject){
    options = options || {};
    debug('Call with options', options);
    var ret = {
      installed: [],
      uninstalled: [],
      missing: [],
      unused: []
    };
    try{
      fs.accessSync(path.resolve(directory, "./package.json"));
      // Read package.json
      var packageJson = JSON.parse(fs.readFileSync(path.resolve(directory, "./package.json"), 'utf8'));
      // Search all js file
      var ignoreFiles = ['node_modules/**', 'bower/**'];
      if(options.ignore) { 
        if(options.ignore instanceof Array) {
            ignoreFiles = ignoreFiles.concat(options.ignore);
        } else {
            ignoreFiles.push(options.ignore);
        }
      }

      // Add custom bower directory to ignore
      try{
        // Can't use require because no .json extension
        var bowerRcJson = JSON.parse(fs.readFileSync(path.resolve(directory, './.bowerrc'), 'utf8'));
        ignoreFiles.push(bowerRcJson.directory+"/**");
      }catch(ex){} // No .bowerrc
      var naiConfig = loadNaiConfig(directory);
      if(naiConfig.ignore) naiConfig.ignore.forEach(function(i){ ignoreFiles.push(i); });

      var files = glob.sync('**/*.js', {cwd: directory, ignore: ignoreFiles});
      var requires = {};
      files.forEach(function(f){
        try{
          debug('Parse file', f);
          var stat = fs.statSync(path.resolve(directory, f));
          if(!stat.isDirectory()) {
            var code = fs.readFileSync(path.resolve(directory, f)).toString().replace('#!/usr/bin/env node', '');
            var prog = require('esprima').parse(code, {tolerant: true});
            // type: 'CallExpression' callee: { type: 'Identifier', name: 'require' }, arguments: [{value: 'koa-livereload'}]
            findRequire(prog).forEach(function(r){
              var temp = _.get(requires, r, []);
              temp.push(f);
              _.set(requires, r, temp);
              // if(!_(systemPackages).contains(r)){
              //   requires.push(r);
              // }
            });
          }
        }catch(ex){
          debug('Error while parsing file', f, ex);
          reject(ex);
        }
      });
      // requires = _.uniq(requires);
      // Find missing and unused
      _.forEach(requires, function(v, r) {
        if(!_.has(packageJson.dependencies, r) && !_.has(packageJson.devDependencies, r) && !_.includes(systemPackages, r)) {
          ret.missing.push({name: r, files: v});
        }
      });
      if(packageJson.dependencies){
        Object.keys(packageJson.dependencies).forEach(function(d) {
          if(!_.has(requires, d) && !_.includes(naiConfig.unused, d)){
            ret.unused.push(d);
          }
        });
      }
      if(packageJson.devDependencies){
        Object.keys(packageJson.devDependencies).forEach(function(d) {
          if(!_.has(requires, d) && !_.includes(naiConfig.unused, d)){
            ret.unused.push(d);
          }
        });
      }

      // If something to install/uninstall
      if((!_.isEmpty(ret.unused) && options.uninstall) || (!_.isEmpty(ret.missing) && options.install)) {
        delete require.cache.npm;
        var npm = require('npm');
        /* istanbul ignore else  */
        if(options.force) {
          npmLoad(npm, directory).then(function(){
            return launchInstallUninstall(npm, options, ret).then(resolve).catch(reject);
          });
        }else{
          var prompt = require("prompt");
          prompt.start();
          property = {
            name: 'yesno',
            message: 'are you sure (y/n)?',
            validator: /y[es]*|n[o]?/,
            warning: 'Must respond yes or no',
            "default": 'yes'
          };
          prompt.get(property, function(err, result) {
            if (result.yesno === 'yes') {
              npmLoad(npm, directory).then(function(){
                return launchInstallUninstall(npm, options, ret).then(resolve).catch(reject);
              });
            } else {
              reject(new Error("Abort install/uninstall"));
            }
          });
        }
      }else{
        resolve(ret);
      }
    }catch(e){
      console.log('not a npm project (missing package.json)', e);
      reject(e);
    }
  });
};

module.exports = AutoInstall;
