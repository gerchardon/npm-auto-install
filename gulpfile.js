var gulp = require('gulp');
var mocha = require('gulp-mocha');

gulp.task('default', ['test']);

gulp.task('test', function(){
  var reporter = 'dot'; // nyan
  return gulp.src('*/*.js', {read: false})
    .pipe(mocha({reporter: reporter, growl: true}));
});

gulp.task('watch', function(){
  gulp.start('test');
  // TODO: Negeate test/data/tmp/
  gulp.watch('**/*.js', ['test']);
});
