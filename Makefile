NPM_BIN=./node_modules/.bin

SOURCEDIR=src
BUILDDIR=dist

JSDOC=$(NPM_BIN)/jsdoc -c
UGLIFY_JS=$(NPM_BIN)/uglifyjs --mangle --compress --bare-returns --stats
BROWSERIFY=$(NPM_BIN)/browserify -d

MAKEFLAGS+=-j 1


all: clean build minify jsdoc_public


clean:
	-rm -rf $(BUILDDIR)


prepare: clean
	-npm install
	mkdir $(BUILDDIR)
	cp $(SOURCEDIR)/flash/build/player-2_0.swf $(BUILDDIR)/player-2_0.swf


build: $(BUILDDIR)/index.js $(BUILDDIR)/modules.js


minify: $(BUILDDIR)/index.min.js $(BUILDDIR)/modules.min.js


$(BUILDDIR)/index.js: prepare
	$(BROWSERIFY) $(SOURCEDIR)/index.js > $(BUILDDIR)/index.js


$(BUILDDIR)/modules.js: prepare
	$(BROWSERIFY) $(SOURCEDIR)/modules.js > $(BUILDDIR)/modules.js


$(BUILDDIR)/index.min.js: $(BUILDDIR)/index.js
	$(UGLIFY_JS) $(BUILDDIR)/index.js > $(BUILDDIR)/index.min.js --source-map $(BUILDDIR)/index.map.json


$(BUILDDIR)/modules.min.js: $(BUILDDIR)/modules.js
	$(UGLIFY_JS) $(BUILDDIR)/modules.js > $(BUILDDIR)/modules.min.js --source-map $(BUILDDIR)/modules.map.json


jsdoc: jsdoc_public jsdoc_private


jsdoc_public: prepare
	-rm -rf dist/public-doc/
	$(JSDOC) jsdoc/jsdoc.public.json


jsdoc_private: prepare
	-rm -rf dist/dev-doc/
	$(JSDOC) jsdoc/jsdoc.private.json


.PHONY: all clean build minify prepare jsdoc jsdoc_public jsdoc_private
