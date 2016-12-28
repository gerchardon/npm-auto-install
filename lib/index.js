var debug = require('debug')('ncp:index'),
    glob = require("glob"),
    fs = require("fs"),
    path = require("path"),
    _ = require('lodash');

var systemPackages = ['fs', 'path', 'child_process'];

function AutoInstall(){}


function loadNaiConfig(directory) {
  return readFileIfExists(path.resolve(directory, './.nairc'))
    .then(function(data) {
      if (!data) {
        return {};
      }
      return JSON.parse(data);
    });
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
        if(err) return reject(err);
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
        if(err) return reject(err);
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
      if(err) return reject(err);
      npm.config.set('save', true);
      npm.localPrefix = directory;
      resolve();
    });
  });
}

function readFile(path) {
  return new Promise(function(resolve, reject) {
    fs.readFile(path, 'utf8', function(err, data) {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });
};

function readFileIfExists(path) {
  return new Promise(function(resolve, reject) {
    fs.access(path, function(err) {
      if (err && err.code !== 'ENOENT') {
        reject(err);
      } else if (err) {
        resolve(null);
      } else {
        readFile(path).then(resolve).catch(reject);
      }
    });
  });
};

AutoInstall.prototype.detectMissing = function(directory, options) {
  // return Promise.resolve({installed:[], uninstalled:[], unused:[], missing:[]});
  options = options || {};
  debug('Call with options', options);
  var ret = {
    installed: [],
    uninstalled: [],
    missing: [],
    unused: []
  };

  var globPromise = function(globs, options) {
    return new Promise(function(resolve, reject) {
      glob(globs, options, function(err, files) {
        if (err) {
          return reject(err);
        }
        resolve(files);
      });
    });
  };

  var packageJsonPath = path.resolve(directory, './package.json');
  var bowerRcPath = path.resolve(directory, './.bowerrc');
  var ignoreFiles = ['node_modules/**', 'bower/**'];
  var requires = {};
  var packageJson, naiConfig;
  // Read package.json
  return readFileIfExists(packageJsonPath)
    .then(function(data) {
      packageJson = JSON.parse(data);
      // Search all js file
      if (options.ignore) {
        if (options.ignore instanceof Array) {
          ignoreFiles = ignoreFiles.concat(options.ignore);
        } else {
          ignoreFiles.push(options.ignore);
        }
      }
      return readFileIfExists(bowerRcPath);
    })
    .then(function(data) {
      if (data) {
        var bowerRcJson = JSON.parse(data);
        ignoreFiles.push(bowerRcJson.directory + "/**");
      }
      return loadNaiConfig(directory);
    })
    .then(function(data) {
      naiConfig = data;
      if (naiConfig.ignore) {
        naiConfig.ignore.forEach(function(f) {
          ignoreFiles.push(f);
        });
      }
      var globOptions = {
        cwd: directory,
        ignore: ignoreFiles
      };
      return globPromise('**/*.js', globOptions);
    })
    .then(function(files) {
      return Promise.all(_.map(files, function(f) {
        debug('Parse file', f);
        return readFile(path.resolve(directory, f))
          .then(function(data) {
            var code = data.toString().replace('#!/usr/bin/env node', '');
            // type: 'CallExpression' callee: { type: 'Identifier', name: 'require' }, arguments: [{value: 'koa-livereload'}]
            var prog = require('esprima').parse(code, {
              tolerant: true
            });
            findRequire(prog).forEach(function(r) {
              var temp = _.get(requires, r, []);
              temp.push(f);
              _.set(requires, r, temp);
              // if(!_.includes(systemPackages, r)){
              //   requires.push(r);
              // }
            });
          }).catch(function(err) {
            debug('Error while parsing file', f, err);
          });
      }));
    })
    .then(function() {
      // requires = _.uniq(requires);
      // Find missing and unused
      _.forEach(requires, function(v, r) {
        if(!_.has(packageJson.dependencies, r) && !_.has(packageJson.devDependencies, r) && !_.includes(systemPackages, r)){
          ret.missing.push({
            name: r,
            files: v
          });
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
          return npmLoad(npm, directory).then(function() {
            return launchInstallUninstall(npm, options, ret);
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
          return new Promise(function(resolve, reject) {
            prompt.get(property, function(err, result) {
              if (result.yesno === 'yes') {
                return npmLoad(npm, directory).then(function() {
                  return launchInstallUninstall(npm, options, ret);
                });
              } else {
                reject(new Error("Abort install/uninstall"));
              }
            });
          });
        }
      }else{
        return ret;
      }

    });
};

module.exports = AutoInstall;
