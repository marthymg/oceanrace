import './App.css';
import { polygonMumbai } from 'wagmi/chains'
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { alchemyProvider } from 'wagmi/providers/alchemy'

import { useAccount, useConnect } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { useContractWrite, usePrepareContractWrite } from 'wagmi'

import {useQuery, gql, ApolloClient, InMemoryCache,} from '@apollo/client';

import { readContract } from '@wagmi/core'

// google stuff
import { GoogleMap, MarkerF, InfoWindowF, useLoadScript, PolylineF } from "@react-google-maps/api";
import { useMemo, useState, Fragment } from "react";

import { connect } from '@wagmi/core';

// global variable for easy going
window.isConnected = false;

const oceanRaceABI = [
      {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "position",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "direction",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "newDirection",
          "type": "string"
        }
      ],
      "name": "setDirection",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }

    
];
 
 
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [polygonMumbai],
  [alchemyProvider({ apiKey: process.env.REACT_APP_ALCHEMY_PROVIDER_KEY })],
)

const config = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
})

// Position
const mainContract = await readContract({
  address: process.env.REACT_APP_CONTRACT_ADDRESS,
  abi: oceanRaceABI,
  functionName: 'position',
  args: [process.env.REACT_APP_CONTRACT_OWNER_ADDRESS],
})
//Direction
const mainContractDirection = await readContract({
  address: process.env.REACT_APP_CONTRACT_ADDRESS,
  abi: oceanRaceABI,
  functionName: 'direction',
  args: [process.env.REACT_APP_CONTRACT_OWNER_ADDRESS],
})

// mapping longitude lon -> lng the googlemaps way
const _mainContractDirection = mainContractDirection.replaceAll("lon", "lng")
const mainContractObjDirection = JSON.parse(_mainContractDirection.replaceAll("'", '"'));

console.log(mainContractObjDirection)

// mapping longitude lon -> lng the googlemaps way
const _mainContract = mainContract.replaceAll("lon", "lng")
const mainContractObj = JSON.parse(_mainContract.replaceAll("'", '"'));

// History data for building the route
//https://api.studio.thegraph.com/query/35556/ocean-race/version/latest

const QUERY_ROUTE = gql`
query {
ocrresponses(first: 40, orderBy: blockNumber, orderDirection: desc) {
    id
    requestId
    result
    err
    blockNumber
    blockTimestamp
  }
  ocrresponses {
    id
  }
}
`
const client = new ApolloClient({
  cache: new InMemoryCache(),
  uri: "https://api.studio.thegraph.com/query/35556/ocean-race/version/latest"
})

const {data} = await client.query({
  query: QUERY_ROUTE ,
})

console.log(data.ocrresponses.length)

// Convert a hex string to a byte array
const hexToBytes = (hex) => {
  var bytes = [];

  for (var c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.substr(c, 2), 16));
  }

  return bytes;
};

// historicle routes formated in right order
let _routes = [];

function AddRowToTable(lat, lng) {
  _routes.push({lat: lat, lng: lng});
}

let obj = {};

await data.ocrresponses.forEach(function(route) {
  if (route.result !='0x')
    {
      
      const bytesStringRoute = String.fromCharCode(... hexToBytes(route.result)).replaceAll("lon", "lng")
      //const _bytesStringRoute = JSON.stringify(bytesStringRoute.replaceAll("\x00", '').replaceAll("'", '"'));
      const _bytesStringRoute = bytesStringRoute.replaceAll("\x00", '').replaceAll("'", '"');

      //let str_obj = '{"lat":"54.14","lng":"7.39","wsp":14.5,"wdi":341,"time":1686135177953}';

      obj = JSON.parse(_bytesStringRoute)
      AddRowToTable(Number(obj.lat), Number(obj.lng))

  } 
})


function App() {

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  });
  const center = useMemo(() => ({ lat: Number(mainContractObj.lat), lng: Number(mainContractObj.lng)}), []);
  
  const [selectedCenter, setSelectedCenter] = useState(null);
  // set marker
  const [markers, setMarker] = useState([]);
  const onMapClick = (e) => {
    setMarker((current) => [
      {
        lat: Number(e.latLng.lat().toFixed(2)),
        lng: Number(e.latLng.lng().toFixed(2))
      }
    ]);
  };

  //const { connect, connectors, error, isLoading, pendingConnector } = useConnect()

  return (
    <>
    <WagmiConfig config={config}>
      <h1>Ocean Race 2023 / Hamburg - New York</h1>
      {window.isConnected && (
      <div>
        My new Direction : {JSON.stringify(markers)}
      </div>
      )}
      <Profile/>
      <ContractWrite value={markers}/>
        <div style={{ height: '100vh', width: '100%' }}>
              {!isLoaded ? (
                <h1>Loading...</h1>
              ) : (
          
                <GoogleMap
                  mapContainerClassName="map-container"
                  center={center}
                  zoom={8}
                  onClick={onMapClick}
                >
                {window.isConnected && markers.map((marker) => (
                    <MarkerF 
                      position={{ 
                        lat: marker.lat,
                        lng: marker.lng 
                      }} />

                ))}

                <MarkerF 
                position={center}
                icon={"https://maps.google.com/mapfiles/ms/icons/sailing.png"}
                onClick={() => {
                  setSelectedCenter(center);
                }}
                >
                {selectedCenter && (
                  <InfoWindowF
                      onCloseClick={() => {
                        setSelectedCenter(null);
                      }}
                      position={{
                        lat: Number(selectedCenter.lat),
                        lng: Number(selectedCenter.lon)
                      }}
                  >
                  <>
                  <div>Position: {JSON.stringify(mainContractObj)}</div>
                  <div>Direction: {JSON.stringify(mainContractObjDirection)}</div>  
                  </>
                  </InfoWindowF>
                )}             
                </MarkerF>
                <PolylineF path={_routes}
                                          
                                          options={{
                                              geodesic: true,
                                              strokeColor: "#ff2527",
                                              strokeOpacity: 0.75,
                                              strokeWeight: 2,
                                          }}
                />
                </GoogleMap>
              )}
            </div>
        </WagmiConfig>
        </>
  );
}

function Profile() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect({
    connector: new InjectedConnector(),
  })
  window.isConnected = isConnected;
  if (isConnected) return <div>Connected to {address}</div>
  return <button onClick={() => connect()}>Connect Wallet</button>
}

function ContractWrite(value) {

   if(!value['value'][0]) {
    value['value'][0] = "";
   }
   
  let _value = JSON.stringify(value['value'][0]).replaceAll('lng', 'lon')
  _value = _value.replaceAll('"', "'")
  
  const { config } = usePrepareContractWrite({
    address: process.env.REACT_APP_CONTRACT_ADDRESS,
    abi: oceanRaceABI,
    functionName: 'setDirection',
    args: [_value],
  })
  const { data, isLoading, isSuccess, write } = useContractWrite(config)
  return (
    <div>
      <button
        disabled={!write}
        onClick={() =>
          write({
            //args: [value],
            //from: '',
          })
        }
      >
        Crew only / set sailing course
      </button>
      {isLoading && <div>Check Wallet</div>}
      {isSuccess && <div>Transaction: {JSON.stringify(data)}</div>}
    </div>
  )
}



export default App;
