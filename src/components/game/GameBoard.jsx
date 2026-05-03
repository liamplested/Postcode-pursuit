import React from 'react';

export default function GameBoard({ map, controls }) {
  return (
    <div className="pp-board">
      {map}
      {controls}
    </div>
  );
}
