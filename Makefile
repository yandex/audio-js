NPM_BIN=./node_modules/.bin

SOURCEDIR=src
BUILDDIR=dist

JSDOC=$(NPM_BIN)/jsdoc -c
UGLIFY_JS=$(NPM_BIN)/uglifyjs --mangle --compress --bare-returns --stats
BROWSERIFY=$(NPM_BIN)/browserify -d


all: clean build minify jsdoc
	git add -A
	git commit


clean:
	-rm -rf $(BUILDDIR)


npm:
	-npm install


prepare: clean npm
	mkdir $(BUILDDIR)
	cp $(SOURCEDIR)/flash/build/*.swf $(BUILDDIR)/


build: $(BUILDDIR)/index.js


minify: $(BUILDDIR)/index.min.js


$(BUILDDIR)/index.js: prepare
	$(BROWSERIFY) $(SOURCEDIR)/index.js > $(BUILDDIR)/index.js


$(BUILDDIR)/index.min.js: $(BUILDDIR)/index.js
	$(UGLIFY_JS) $(BUILDDIR)/index.js > $(BUILDDIR)/index.min.js --source-map $(BUILDDIR)/index.map.json


jsdoc: npm
	-rm -rf spec
	-mkdir spec
	$(JSDOC) jsdoc/jsdoc.public.json -q "style=gfm-files"
	$(JSDOC) jsdoc/jsdoc.public.json -q "style=gfm-single&out=full"
	$(JSDOC) jsdoc/jsdoc.public.json -d $(BUILDDIR)/ -q "style=jsdoc&out=audio"


.PHONY: all clean build minify prepare npm jsdoc
