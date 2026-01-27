import React from 'react';
import {Composition} from 'remotion';
import {CreateSuiteTour} from './CreateSuiteTour';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CreateSuiteTour"
        component={CreateSuiteTour}
        durationInFrames={540}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
