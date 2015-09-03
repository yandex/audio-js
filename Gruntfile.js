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
                    sourceMapName : BUILDDIR + "/index.map.json"
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-mkdir');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // Default task.
    grunt.registerTask('default', ['clean', 'mkdir', 'browserify', 'uglify']);
};
