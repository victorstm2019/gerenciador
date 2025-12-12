import React, { useState } from 'react';

const MessageConfig2: React.FC = () => {
  const [autoSendMessages, setAutoSendMessages] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);

  return (
    <div style={{padding: '50px'}}>
      <h1 style={{fontSize: '40px', color: 'red'}}>TESTE BOTÕES</h1>
      
      <div style={{backgroundColor: 'yellow', padding: '30px', margin: '20px 0'}}>
        <label style={{display: 'block', fontSize: '24px', margin: '20px 0'}}>
          <input 
            type="checkbox" 
            checked={autoSendMessages} 
            onChange={(e) => setAutoSendMessages(e.target.checked)}
            style={{width: '40px', height: '40px'}}
          />
          <span style={{marginLeft: '20px'}}>Envio Automático: {autoSendMessages ? 'ATIVO' : 'INATIVO'}</span>
        </label>
        
        <label style={{display: 'block', fontSize: '24px', margin: '20px 0'}}>
          <input 
            type="checkbox" 
            checked={autoSendEnabled} 
            onChange={(e) => setAutoSendEnabled(e.target.checked)}
            style={{width: '40px', height: '40px'}}
          />
          <span style={{marginLeft: '20px'}}>Modo Fila: {autoSendEnabled ? 'ATIVO' : 'INATIVO'}</span>
        </label>
      </div>
    </div>
  );
};

export default MessageConfig2;
