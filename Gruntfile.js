module.exports = function(grunt) {
  grunt.initConfig({
    karma: {
      integration: {
        options: {
          files: [
            'test/vendor/jquery.js',
            'test/vendor/underscore.js',
            'test/vendor/backbone.js',
            'test/vendor/backbone.marionette.js',
            'Marionette.BossView.js',
            'test/vendor/chai.js',
            'test/vendor/sinon.js',
            'test/BossViewTest.coffee'
          ]
        },
        singleRun: true,
        browsers: ['Chrome'],
        frameworks: ['mocha'],
        reporters: ['dots']
      }
    }
  });

  grunt.loadNpmTasks('grunt-karma');

  grunt.registerTask('test', ['karma']);

};