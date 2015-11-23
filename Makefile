NPM_BIN=./node_modules/.bin

SOURCEDIR=src
BUILDDIR=dist

JSDOC=$(NPM_BIN)/jsdoc -c
UGLIFY_JS=$(NPM_BIN)/uglifyjs --mangle --compress --bare-returns --stats
BROWSERIFY=$(NPM_BIN)/browserify -d

MAKEFLAGS+=-j 1


all: clean build minify jsdoc_public
	git add -A
	git commit


clean:
	-rm -rf $(BUILDDIR)


prepare: clean
	-npm install
	mkdir $(BUILDDIR)
	cp $(SOURCEDIR)/flash/build/*.swf $(BUILDDIR)/


build: $(BUILDDIR)/index.js


minify: $(BUILDDIR)/index.min.js


$(BUILDDIR)/index.js: prepare
	$(BROWSERIFY) $(SOURCEDIR)/index.js > $(BUILDDIR)/index.js


$(BUILDDIR)/index.min.js: $(BUILDDIR)/index.js
	$(UGLIFY_JS) $(BUILDDIR)/index.js > $(BUILDDIR)/index.min.js --source-map $(BUILDDIR)/index.map.json


jsdoc: jsdoc_public jsdoc_private


jsdoc_public: prepare
	-rm -rf dist/public-doc/
	$(JSDOC) jsdoc/jsdoc.public.json


jsdoc_private: prepare
	-rm -rf dist/dev-doc/
	$(JSDOC) jsdoc/jsdoc.private.json


.PHONY: all clean build minify prepare jsdoc jsdoc_public jsdoc_private
