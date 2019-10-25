import { fromLonLat } from 'ol/proj';
import Map from 'ol/Map';
import MVT from 'ol/format/MVT';
import stylefunction from 'ol-mapbox-style/stylefunction';
import Overlay from 'ol/Overlay';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import View from 'ol/View';
import {
  Fill, Stroke, Style, Text,
} from 'ol/style';

const ATTR_APN = 'apn';
const ATTR_FIREHAZ = 'firehazard';
const URL_BASE_SC = 'http://sc-tileserver-gl-scfire.openshift-pousty-apps.gce-containers.crunchydata.com';
const URL_DATA_SC = 'http://tegola-scfire.openshift-pousty-apps.gce-containers.crunchydata.com';

const URL = {
  base: URL_BASE_SC,
  data: URL_DATA_SC,
};

/**
 * @param {Object} elements
 * @param {HTMLElement} elements.mapContainer
 * @param {HTMLElement} elements.popupCloser
 * @param {HTMLElement} elements.popupContainer
 * @param {HTMLElement} elements.popupContent
 */
export default function CrunchyMap(elements) {
  const {
    mapContainer,
    popupCloser,
    popupContainer,
    popupContent,
  } = elements;

  /** lookup for highlighted objects */
  let highlighted = null;

  /** layer for popups */
  const overlay = new Overlay({
    element: popupContainer,
    autoPan: true,
    autoPanAnimation: {
      duration: 250,
    },
  });

  const map = new Map({
    target: mapContainer,
    overlays: [overlay],
    view: new View({
      center: fromLonLat([-122.0225, 37.0]),
      zoom: 15,
    }),
  });

  const layerBase = new VectorTileLayer({
    declutter: true,
    source: new VectorTileSource({
      format: new MVT(),
      url: `${URL.base}/data/v3/{z}/{x}/{y}.pbf`,
      maxZoom: 14,
    }),
  });

  fetchGlStyle().then(glStyle => {
    stylefunction(
      layerBase,
      glStyle,
      'openmaptiles',  // source id from style file - shows all layers
      // ['landuse-residential', 'park', 'water']  // can specify individual layers
    );
  });

  const layerData = new VectorTileLayer({
    // className: 'dataLayer', // needed to avoid base labels disappearing?
    style: dataStyle,
    declutter: true,
    source: new VectorTileSource({
      format: new MVT(),
      url: `${URL.data}/maps/parcels/{z}/{x}/{y}.pbf`,
      maxZoom: 14,
    }),
  });

  map.addLayer(layerBase);
  map.addLayer(layerData);

  function dataStyle(feature) {
    if (isHighlighted(feature)) {
      return createStyleSelected(feature);
    }
    if (feature.get(ATTR_FIREHAZ) === 'Yes') {
      return createStyleFire(feature);
    }
    return createStyleParcel(feature);
  }

  function isHighlighted(feature) {
    if (!highlighted) return false;
    return feature.id_ === highlighted.id_;
  }

  // ==================================================
  // Highlighted feature
  // see https://openlayers.org/en/latest/examples/vector-tile-selection.html?q=select
  //     https://openlayers.org/en/latest/examples/select-features.html
  // ==================================================

  map.on('pointermove', evt => {
    if (evt.dragging) {
      return;
    }
    const features = map.getFeaturesAtPixel(evt.pixel);
    const feature = features ? features[0] : null;

    highlightFeature(feature);
  });

  map.on('singleclick', evt => {
    const features = map.getFeaturesAtPixel(evt.pixel);
    const feature = features ? features[0] : null;

    showParcelPopup(evt, feature);
  });

  function highlightFeature(feature) {
    // add selected feature to lookup
    highlighted = feature || null;

    // force redraw of layer style
    layerData.setStyle(layerData.getStyle());
  }

  // ==================================================
  // Popup
  // see https://openlayers.org/en/latest/examples/popup.html
  // ==================================================

  /**
   * Add a click handler to hide the popup.
   * @return {boolean} Don't follow the href.
   */
  popupCloser.onclick = () => {
    overlay.setPosition(undefined);
    popupCloser.blur();
    return false;
  };

  function showParcelPopup(evt, feature) {
    if (feature.get('layer') !== 'parcels') {
      overlay.setPosition(undefined);
      return;
    }
    const { coordinate } = evt;
    const id = feature.id_;
    popupContent.innerHTML = `${'<p>'
      + '<b>Parcel '}${id}</b>`
      + '</p>'
      + `<p>APN: ${feature.get(ATTR_APN)}</p>`;
    overlay.setPosition(coordinate);
  }

  return map;
}

async function fetchGlStyle() {
  const response = await fetch(`${URL.base}/styles/osm-bright/style.json`);
  return response.json();
}

function createStyleSelected(feature) {
  return new Style({
    fill: new Fill({ color: 'rgba(200,200,20,0.2)' }),
    stroke: new Stroke({
      color: 'rgba(255,255,20,1)', width: 3,
    }),
    text: new Text({
      text: `${feature.id_}`,
      font: '14px sans-serif',
      fill: new Fill({ color: '#000000' }),
    }),
  });
}

function createStyleParcel(feature) {
  return new Style({
    fill: new Fill({ color: '#80ff8010' }),
    stroke: new Stroke({
      color: '#007000',
    }),
    text: new Text({
      text: `${feature.id_}`,
      fill: new Fill({ color: '#000000' }),
    }),
  });
}

function createStyleFire(feature) {
  return new Style({
    fill: new Fill({
      color: '#ff000020',
    }),
    stroke: new Stroke({
      color: '#ff0000',
      width: 2,
    }),
    text: new Text({
      text: feature.get(ATTR_FIREHAZ),
      fill: new Fill({
        color: '#000000',
      }),
    }),
  });
}
