import React from 'react';
import ReactDOM from 'react-dom';
import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import {injectStylesFromConfig} from './options';
import {Root} from './Root';
import {getBasePath} from './api-utils';

const App = () => {
  const basePath = getBasePath();
  return (
    <Router basename={basePath}>
      <Routes>
        <Route path="/" element={<Root />} />
      </Routes>
    </Router>
  );
};

injectStylesFromConfig();
ReactDOM.render(<App />, document.getElementById('application'));
