steal("can/control", "can/util","jquery",function(Control, can, $){
	var pageConfig = window.docObject || {};
	
	var combine = function(first, second){
		var right = first[first.length -1],
			left = second[0];
		if(right != "/" && left != "/") {
			return steal.joinURIs(first,second);
		} else if(right == "/" && left == "/") {
			return left+second.substr(1);
		} else {
			return first+second;
		}
	};
	var dirname = function(path){
		var parts = path.split("/");
		parts.pop();
		return parts.join("/");
	};
	return Control.extend({
		setup: function(el, options){
			el = $(el);
			var container = $("<select class='versions'/>").hide();
			el.after(container);
			return Control.prototype.setup.call(this, container, options);
		},
		init: function(){
			if(pageConfig.project && pageConfig.project.version) {
				var self = this;
				
				$.ajax(pageConfig.docConfigDest || "../../documentjs.json", {
					success: function(docConfig){
						self.docConfig = docConfig;
						var versions = [];
						$.each(docConfig.versions||[], function(name){
							versions.push(name);
						});
						self.addOptions(versions);
					},
					error: function(){
						// self.addOptions(["0.0.0","0.0.1"]);	
					},
					dataType: "json"
				});
			}
			
		},
		addOptions: function(versions){
			this.versions = versions;
			var html = "";
			can.each(versions, function(version){
				html += "<option value='"+version+"'"+
							(version == pageConfig.project.version ? 
								" SELECTED" : "") +
						">"+ version+
						"</option>";
			});
			this.element.html(html).fadeIn();
		},
		getVersionedParentPath: function(version ){
			
			var path = this.docConfig.versionDest.replace(/<%=\s*version\s*%>/,""+version)
				.replace(/<%=\s*name\s*%>/,""+pageConfig.project.name);
			return dirname(path);
		},
		getDefaultParentPath: function(){
			var path = this.docConfig.defaultDest.replace(/<%=\s*name\s*%>/,""+pageConfig.project.name);
			return dirname(path);
		},
		'change': function(el, ev) {
			var newVersion = this.element.val(),
				version = pageConfig.project.version,
				loc = ""+window.location,
				isVersioned = loc.indexOf("/"+version+"/") >= 0,
				versions = this.versions,
				isNewCurrentVersion = false,
				defaultVersion = this.docConfig.defaultVersion,
				defaultDest = this.getDefaultParentPath();
				
			for(var i =0 ; i < versions.length; i++){
			
				if(versions[i] == defaultVersion && versions[i] == newVersion){
					isNewCurrentVersion = true;
				} 
			}
	
			// All of this needs to use defaultDest and dest
	
			// going old to new
			if( isVersioned && isNewCurrentVersion )  {
				var afterVersion = loc.replace(new RegExp(".*"+version),"");
				
				var toDocumentJSON = steal.joinURIs(window.location.pathname, 
					pageConfig.docConfigDest );
					
				var toDefaultDest = steal.joinURIs(toDocumentJSON,defaultDest);
				
				window.location = toDefaultDest+afterVersion;
				
			// going new to old
			} else if( !isVersioned ) {
				// need to preserve where we are
				var toDocumentJSON = steal.joinURIs(window.location.pathname, 
					pageConfig.docConfigDest );
				var toDefaultDest = steal.joinURIs(toDocumentJSON,defaultDest);
				// get what's added after the default dest
				var after = window.location.pathname.replace( toDefaultDest, "");
				// get the versioned part
				var versioned = combine(toDocumentJSON, this.getVersionedParentPath(newVersion));

				window.location = versioned+after;
				
			} else {
				// going old to old
				
				window.location = loc.replace("/"+version+"/","/"+newVersion+"/");
			}
			
		}
	});

});

