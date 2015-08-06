var gulp = require('gulp');
var mocha = require('gulp-mocha');
var coveralls = require('gulp-coveralls');
var istanbul = require('gulp-istanbul');

gulp.task('default', ['test']);

gulp.task('test', function(){
  var reporter = 'spec';
  return gulp.src('test/*.js', {read: false})
    .pipe(mocha({reporter: reporter, growl: true}));
});

gulp.task('coverage', function(cb){
  gulp.src('lib/**/*.js')
    .pipe(istanbul())
    .pipe(istanbul.hookRequire())
    .on('finish', function () {
      gulp.src(['test/*.js'])
        .pipe(mocha())
        .pipe(istanbul.writeReports()) // Creating the reports after tests runned
        .pipe(istanbul.enforceThresholds({ thresholds: { global: 80 } })) // Enforce a coverage of at least 90%
        .on('end', cb);
    });
});

gulp.task('coveralls', ['coverage'], function(){
  gulp.src('coverage/lcov.info')
    .pipe(coveralls());
});

gulp.task('watch', function(){
  gulp.start('test');
  gulp.watch(['./**/*.js', '!./test/data/tmp/**'], ['test']);
});
