NPM_BIN=./node_modules/.bin

SOURCEDIR=src
BUILDDIR=dist

JSDOC=$(NPM_BIN)/jsdoc -c
UGLIFY_JS=$(NPM_BIN)/uglifyjs --mangle --compress --bare-returns --stats
BROWSERIFY=$(NPM_BIN)/browserify -d

MAKEFLAGS+=-j 1


all: clean build minify jsdoc
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


jsdoc: prepare
	-rm -rf spec/*
	-mkdir spec
	$(JSDOC) jsdoc/jsdoc.public.json -q style=gfm-files
	$(JSDOC) jsdoc/jsdoc.public.json -q style=jsdoc-tech


.PHONY: all clean build minify prepare jsdoc
