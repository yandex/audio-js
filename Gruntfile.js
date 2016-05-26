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
            options: {
                debug: true
            },
            main: {
                src: "./src/index.js",
                dest: BUILDDIR + "/index.js"
            },
            modules: {
                src: "./src/modules.js",
                dest: BUILDDIR + "/modules.js"
            }
        },

        uglify: {
            options: {
                mangle: true,
                compress: true,
                bareReturns: true,
                stats: true
            },
            main: {
                src: BUILDDIR + '/index.js',
                dest: BUILDDIR + '/index.min.js',
                options: {
                    sourceMap: true,
                    sourceMapName: BUILDDIR + "/index.map.json"
                }
            },
            modules: {
                src: BUILDDIR + '/modules.js',
                dest: BUILDDIR + '/modules.min.js',
                options: {
                    sourceMap: true,
                    sourceMapName: BUILDDIR + "/modules.map.json"
                }
            }
        },

        copy: {
            flash: {
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
    grunt.registerTask('all', ['build', 'uglify']);

    // Default task.
    grunt.registerTask('default', ['all']);
};
