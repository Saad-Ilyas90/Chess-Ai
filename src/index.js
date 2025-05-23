import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import AuthWrapper from './Auth/AuthWrapper';
import registerServiceWorker from './registerServiceWorker';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';

const chessLight = getMuiTheme({
  palette: {
    primary1Color: '#4CAF50',
    primary2Color: '#388E3C',
    primary3Color: '#C8E6C9',
    accent1Color: '#FF5722',
    textColor: '#333',
    alternateTextColor: '#ffffff',
    canvasColor: '#ffffff',
    borderColor: '#e0e0e0',
    disabledColor: '#bdbdbd'
  },
  appBar: {
    textColor: '#333',
  },
  slider: {
    trackColor: '#aaa',
    selectionColor: '#4CAF50'
  },
});

ReactDOM.render(
  <MuiThemeProvider muiTheme={chessLight}>
    <AuthWrapper>
      <App />
    </AuthWrapper>
  </MuiThemeProvider>, 
  document.getElementById('root')
);
registerServiceWorker();
