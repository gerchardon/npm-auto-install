[![npm version](https://img.shields.io/npm/v/npm-auto-install.svg)](https://npmjs.org/package/npm-auto-install)
[![Dependency Status](https://david-dm.org/gerchardon/npm-auto-install.svg)](https://david-dm.org/gerchardon/npm-auto-install)
[![devDependency Status](https://david-dm.org/gerchardon/npm-auto-install/dev-status.svg)](https://david-dm.org/gerchardon/npm-auto-install#info=devDependencies)


# Usage

Install with :

```
npm install -g npm-auto-install
```

Usage command line (in npm project):

```
nai

  missing : koa (index.js)
  missing : koa-jwt (index.js)
  unused : koa-route
```

Or with auto install uninstall :

```
nai -iu
```

Or with gulp watch :
```
var gulp = require('gulp');
var AutoInstall = require('npm-auto-install');
gulp.task('nai', function(){
  return new AutoInstall().detectMissing(process.cwd(),{install: true, force:true, uninstall: true});
});

gulp.task('watch', function(){
  gulp.watch(['./**/*.js', '!./node_modules/**'], ['nai']);
});
```

# Contrib

Please [file an issue](https://github.com/gerchardon/npm-auto-install/issues) on github!
Contributors are responsive and happy to assist.

Pull requests are also welcome :)
