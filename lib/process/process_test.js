var process = require("./process"),
	tnd = require("../tags/helpers/typeNameDescription"),
	getParent = require("../tags/helpers/getParent"),
	assert = require("assert"),
	tags = require("../tags/tags"),
	Handlebars = require("handlebars"),
	finalizeDocMap = require("./finalize_doc_map"),
	fs = require("fs"),
	path = require("path");


	var propertyTag = {
		codeMatch: function( code ) {
			return code.match(/(\w+)\s*[:=]\s*/) && !code.match(/(\w+)\s*[:=]\s*function\(([^\)]*)/);
		},
		code: function( code, scope, docMap ) {
			var parts = code.match(/(\w+)\s*[:=]\s*/);
			if ( parts ) {
				var parentAndName = getParent.andName({
					parents: "*",
					useName: ["constructor","static","prototype","function"],
					scope: scope,
					docMap: docMap,
					name: parts[1]
				});
				return {
					name: parentAndName.name,
					parent: parentAndName.parent,
					type: "property"
				};
			}
		},
		add: function(line, curData, scope, docMap){
			var data = tnd(line);
			this.types = data.types
			this.description = data.description;

			var parentAndName = getParent.andName({
				parents: "*",
				useName: ["constructor","static","prototype","function"],
				scope: scope,
				docMap: docMap,
				name: data.name
			});
			this.name = parentAndName.name;
			this.parent = parentAndName.parent;
			this.type = "property";
		},
		parentTypes: ["constructor"],
		useName: true
	};

	describe("documentjs/lib/process", function(){


		it(".comment adds to parent",function(){
			var docMap = {Foo: {name: "Foo",type: "constructor"}};

			process.comment({
				comment: "@property {Object} tags Tags for something",
				scope: docMap.Foo,
				docMap: docMap,
				docObject: {},
				tags: {property: propertyTag}
			},function(newDoc, newScope){
				assert.equal(newScope, docMap.Foo, "same scope scope");
				assert.equal(newDoc.name, "Foo.tags");
			});
		});

		it(".comment change scope", function(){
			var tags = {
				constructor: {
					add : function(){
						this.name = "constructed";
						this.type = "constructor";
						return ["scope",this];
					}
				},
				parent: {
					add: function(){
						this.parent = "parented"
					}
				},
				property: propertyTag
			};

			var docMap = {Foo: {name: "Foo",type: "constructor"}},
				props = {};

			process.comment({
				comment:   ["@constructor",
							"@parent tang"],
				scope: docMap.Foo,
				docMap: docMap,
				docObject: props,
				tags: tags
			},function(newDoc, newScope){
				assert.equal(newDoc, newScope, "new doc item is new scope");
				assert.equal(newDoc, props, "props is the new doc object");

				assert.deepEqual(newDoc,{
					name: "constructed",
					type: "constructor",
					parent: "parented",
					body: "",
					description: ""
				});
			});

		});

		it(".code",function(){
			var tags = {
				constructor: {
					codeMatch: /some constructor/,
					code: function(code, scope, objects){
						return {
							type: "constructor",
							name: "Bar"
						};
					},
					codeScope: true
				},
				property: propertyTag
			};
			var docMap = {Foo: {name: "Foo",type: "constructor"}};
			process.code({
				code: "some constructor",
				docMap: docMap,
				scope: docMap.Foo,
				tags: tags
			}, function(constructorDoc, constructorScope){
				assert.equal(constructorDoc, constructorScope, "scope is the constructor");

				process.code({
					code: "prop = 'something'",
					scope: constructorScope,
					docMap: docMap,
					tags: tags
				}, function(propDoc, propScope){
					assert.equal(propScope, constructorScope, "prop doesn't change scope");
					assert.equal(propDoc.name,"Bar.prop");
					assert.equal(propDoc.parent,"Bar");

				});

			});
		});

		var makeDescription = function( comment, cb ){
			var docMap = {Foo: {name: "Foo",type: "constructor"}},
				props = {};

			var tags = {
				constructor: {
					add : function(){
						this.name = "constructed";
					}
				}
			};

			process.comment({
				comment:   comment,
				scope: docMap.Foo,
				docMap: docMap,
				docObject: props,
				tags: tags
			},cb);
		};


		it("description",function(){

			makeDescription(
				["This is a description.",
				 "Another line."], function(newDoc){
					assert.equal(newDoc.description, "This is a description.\nAnother line.\n")
			});

		});


		it("description then body",function(){

			makeDescription(
				["This is a description.",
				 "Another line.",
				 "",
				 "the body"], function(newDoc){
					assert.equal(newDoc.description, "This is a description.\nAnother line.\n");

					assert.equal(newDoc.body, "\nthe body\n");
			});

		});
		// no longer works because @prototype is fixed, but not sure how to still errors this without creating
		// an evil tag
		/*it.only("process.file errors if name is changed", function(){
			assert.throws(function(){
				process.file("/** @constructor foo.bar *"+"/\n// \n/** @add foo.bar\n@prototype *"+"/",{},"foo.js");
			}, function(e){
				console.log(e);
				return e.message.indexOf("Changing name") >= 0;
			});
		});*/
		it("@prototype adds its own object", function(){
			var docMap = {};
			process.file("/** @constructor foo.bar *"+"/\n// \n/** @add foo.bar\n@prototype *"+"/",docMap,"foo.js");
			assert.ok(docMap["foo.bar"], "foo.bar exists");
			assert.ok(docMap["foo.bar.prototype"], "foo.bar.prototype exists");
		});

		it("processing mustache files", function(){
			var docMap = {};
			var originalRenderer = function(){};
			originalRenderer.layout = function(data){
				return data.content;
			};
			originalRenderer.Handlebars =Handlebars;
			process.file("{{name}}",docMap,"foo.mustache");
			assert.ok(docMap.foo.renderer, "got renderer");

			var result = docMap.foo.renderer(docMap.foo, originalRenderer);
			assert.equal(result,"foo", "got back holler");
		});

		it("end is not called twice", function(){
			var docMap = {};
			var timesCalled = 0;
			tags.foo = {done: function(){
				timesCalled++;
			}};
			process.file("/** @constructor foo.bar *"+"/\n// \n/** @add foo.bar *"+"/",docMap,"foo.js");

			assert.equal(timesCalled, 0, "done should only be called at the end");

			finalizeDocMap(docMap,tags);
			assert.equal(timesCalled, 1, "done should only be called at the end");

		});

		it("can document a module with multiple exports", function(done){
			fs.readFile(path.join(__dirname,"test","module_with_multiple_exports.js"), function(err, data){
				if(err) {
					return done(err);
				}
				var docMap = {};
				process.file(""+data,docMap,"utils/math.js");
				assert.ok(docMap["utils/math"], "got the module");
				assert.ok(docMap["utils/math.sum"], "got the sum docObject");
				assert.ok(docMap["utils/math.constants"], "got the constants docObject");

				done();
			});

		});

		it("can document a module that exports a single function", function(done){
			fs.readFile(path.join(__dirname,"test","module_with_single_export_function.js"), function(err, data){
				if(err) {
					return done(err);
				}
				var docMap = {};
				process.file(""+data,docMap,"utils/add.js");

				assert.equal(docMap["utils/add"].types[0].params[0].name, "first", "got a param");
				assert.equal(docMap["utils/add"].types[0].params[1].name, "second", "got a param");

				done();
			});
		});


	});