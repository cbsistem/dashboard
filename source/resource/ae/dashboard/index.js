//Save Plotly functions before to override them
var _newPlot = Plotly.newPlot;
var _plot = Plotly.plot;
var _addTraces = Plotly.addTraces;
var _restyle = Plotly.restyle;

Plotly.converters = {};

//Override plot function
Plotly.plot = function(gd, data, layout, datasources, config){
	//Call parent's function
	_newPlot(gd, data, layout, config);
	if(datasources){
		//get html element because gd can be a string or a DOM element
		var gd = getGraphDiv(gd);
		//set datasources to the DOM element
		gd.datasources=datasources;
		//load data to traces from data sources
		loadData(gd,data,datasources);
	}
}

//Override newPlot function
Plotly.newPlot = function(gd, data, layout, datasources, config){
	Plotly.plot(gd, data, layout, datasources, config);
}

//Override addTraces function
Plotly.addTraces = function(gd, traces, newIndices){
	//Call parent's function
	_addTraces(gd, traces, newIndices);
	//get html element because gd can be a string or a DOM element
	var gd = getGraphDiv(gd);
	//load data to traces from data sources
	loadData(gd,traces,gd.datasources);
}

//Override restyle function
Plotly.restyle = function(gd, update, indices){
	//Call parent's function
	_restyle(gd, update, indices);
	//get html element because gd can be a string or a DOM element
	var gd = getGraphDiv(gd);
	//check if source is updated
	for(var key in update){
		if(key.indexOf("source")>-1){
			//load data to traces from data sources
			loadData(gd,gd.data,gd.datasources);
			break;
		}
	}
}

//Plot chart from JSON specification defined at specified url
Plotly.load = function(gd,url,callback){
	Plotly.d3.json(url,function(error, result) {
		Plotly.plot(gd, result.data, result.layout, result.datasources, result.config);
		if(callback){
			callback(result);
		}
	})
}

//Update datasources
Plotly.updateDataSources = function(gd, update){
	//get html element because gd can be a string or a DOM element
	var gd = getGraphDiv(gd);
	//set datasources to the DOM element
	gd.datasources=update;
	//load data to traces from data sources
	loadData(gd,gd.data,gd.datasources);
}

Plotly.converters.KDB = function(response,parameters){

	var resp=JSON.parse(response);
	var data={
		x:[[]],
		y:[[]]
	};
	var values  =resp.queries[0].results[0].values;
	for (var i = 1; i < values.length; i++) {
		data.x[0].push(new Date(values[i][0]));
		data.y[0].push(parseFloat(values[i][1]));
	}
	return data;
};

Plotly.converters.CSV = function(response,parameters){
	var lines = response.split("\n");
	var separator=",";
	if(parameters!=null){
		if(parameters.separator!=null){
			var separator=parameters.separator;
		}
	}
	
	var data={};
	for(var key in parameters){
		if(key!="separator"){
			data[key]=[[]];
			var format = parameters[key+"format"];
			for (var i = 1; i < lines.length; i++) {
				var val = lines[i].split(separator);
				if(format=="date"){
					data[key][0].push(new Date(val[parameters[key]]));
				}else{
					data[key][0].push(val[parameters[key]]);
				}
				
			}
		}
	}
	return data;
};


//
function loadData(gd,traces,datasources,tIndices,dsIndices){
	//For each datasource, execute the request
	for(var i=0;i<datasources.length;i++){
		(function(index){
			
			var u = datasources[index].url;
			for(key in datasources[index].parameters){
				u += key + "=" +datasources[index].parameters[key] + "&"
			}
			
			var updateTraces = function(u){
				Plotly.d3.xhr(u,function(error, result) {

					//For each trace 
					for(var k=0;k<traces.length;k++){
						//Check if it uses a data source
						if(traces[k].source!=null){
							//If it's the current datasource
							if(traces[k].source.id==datasources[index].id){
								//Use a specified converter or a script
								if(traces[k].source.converter.name!=null){
									var data = Plotly.converters[traces[k].source.converter.name](result.responseText,traces[k].source.converter.parameters);
									_restyle(gd,data,k);
								}else{
									//Use script attribute to create a new function and execute it
									var tmpFunc = new Function('response','param',traces[k].source.converter.script);
									var data = tmpFunc(result.responseText,traces[k].source.converter.parameters);
									_restyle(gd,data,k);
								};
							}
						}
					}
				});
			};
			
			updateTraces(u);
			
		})(i)
	}
}

function refreshData(gd,traces,datasources,tIndices,dsIndices){
	var refresh = 5;
	console.log(datasources);
	if(refresh){
		var id = setInterval(function(){loadData(gd,traces,datasources,tIndices,dsIndices);},refresh*1000);
	}
}

// Get the container div: we store all variables for this plot as
// properties of this div
// some callers send this in by DOM element, others by id (string)
function getGraphDiv(gd) {
	var gdElement;

	if(typeof gd === 'string') {
		gdElement = document.getElementById(gd);

		if(gdElement === null) {
			throw new Error('No DOM element with id \'' + gd + '\' exists on the page.');
		}

		return gdElement;
	}
	else if(gd === null || gd === undefined) {
		throw new Error('DOM element provided is null or undefined');
	}

	return gd;  // otherwise assume that gd is a DOM element
}