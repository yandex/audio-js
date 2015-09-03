module.exports = function(grunt) {

    var BUILDDIR = "./dist";

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: [BUILDDIR],

        mkdir: {
            options: {
                create: [BUILDDIR]
            }
        },

        browserify: {
            build: {
                src: "./src/index.js",
                dest: BUILDDIR + "/index.js",
                options: {
                    debug: true
                }
            }
        },

        uglify: {
            options: {
                mangle: true,
                compress: true,
                bareReturns: true,
                stats: true
            },
            build: {
                src: 'src/index.js',
                dest: BUILDDIR + '/index.min.js',
                options: {
                    sourceMap: true,
                    sourceMapName: BUILDDIR + "/index.map.json"
                }
            }
        },

        copy: {
            build: {
                src: "./src/flash/build/player-2_0.swf",
                dest: BUILDDIR + "/player-2_0.swf"
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-mkdir');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask('build', ['clean', 'mkdir', 'browserify', 'copy']);

    // Default task.
    grunt.registerTask('default', ['build', 'uglify']);
};
