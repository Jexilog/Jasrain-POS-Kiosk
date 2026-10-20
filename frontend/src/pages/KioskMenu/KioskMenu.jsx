import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../../context/KioskContext';
import './KioskMenu.css';
import Icon from '../../components/Icon';

export default function KioskMenu() {
  const { theme, toggleTheme, language, toggleLanguage } = useKiosk();
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleSelectOption = (optionName) => {
    switch (optionName) {
      case 'checkout':
        navigate('/checkout');
        break;
      case 'printing':
        navigate('/printing');
        break;
      case 'language':
        toggleLanguage();
        break;
      case 'help':
        setIsHelpModalOpen(true);
        break;
      default:
        console.warn(`Unknown option: ${optionName}`);
    }
  };

  return (
    <div className={`kioskScreen ${theme}Mode`}>
      <div className="topBar">
        <button className="themeButton" onClick={toggleTheme} aria-label="Toggle visual theme">
          {<Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />} {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      <header className="storeHeader">
        <span className="welcomeText">WELCOME TO</span>
        <h1 className="brandTitle">JASRAIN</h1>
        <p className="brandSubtitle">STORE &amp; COMPUTER SHOP</p>
      </header>

      <p className="instructionText">Tap an option below to begin</p>

      <main className="menuGrid">
        <button className="serviceCard" onClick={() => handleSelectOption('checkout')} aria-label="Self Checkout">
          <div className="cardIcon" aria-hidden="true"><Icon name="cart" size={56} /></div>
          <h2 className="cardTitle">SELF CHECKOUT</h2>
          <p className="cardDescription">Scan &amp; pay for store items, drinks, &amp; snacks</p>
        </button>

        <button className="serviceCard" onClick={() => handleSelectOption('printing')} aria-label="Printing Services">
          <div className="cardIcon" aria-hidden="true"><Icon name="printer" size={56} /></div>
          <h2 className="cardTitle">PRINTING SERVICES</h2>
          <p className="cardDescription">Print documents, photos, certificates, &amp; files</p>
        </button>
      </main>

      <footer className="footerBar">
        <button className="utilityButton" onClick={() => handleSelectOption('language')}>
          <span className="buttonIcon"><Icon name="globe" size={20} /></span>
          <span className="buttonLabel">{language}</span>
        </button>

        <button className="utilityButton helpButton" onClick={() => handleSelectOption('help')}>
          <span className="buttonIcon"><Icon name="help" size={20} /></span>
          <span className="buttonLabel">Help</span>
        </button>
      </footer>

      {isHelpModalOpen && (
        <div className="helpModalOverlay" onClick={() => setIsHelpModalOpen(false)}>
          <div className="helpModalContent" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="helpTitle">
            <h2 id="helpTitle" className="helpModalTitle">Need Assistance?</h2>
            <div className="helpModalBody">
              <p><Icon name="pin" size={16} /> <strong>Self Checkout:</strong> Scan items using the barcode scanner and follow instructions on screen.</p>
              <p><Icon name="file" size={16} /> <strong>Printing:</strong> Insert your USB flash drive or transfer files via QR code.</p>
              <p><Icon name="user" size={16} /> <strong>Staff Help:</strong> If you need further assistance, please inform the store counter.</p>
            </div>
            <button className="helpModalCloseButton" onClick={() => setIsHelpModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}