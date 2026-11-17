import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKiosk } from '../../context/KioskContext';
import './KioskMenu.css';
import Icon from '../../components/Icon';

export default function KioskMenu() {
  const { theme, toggleTheme, language, toggleLanguage, t } = useKiosk();
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
          {<Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />} {theme === 'dark' ? t('Light Mode') : t('Dark Mode')}
        </button>
      </div>

      <header className="storeHeader">
        <span className="welcomeText">{t('WELCOME TO')}</span>
        <h1 className="brandTitle">JASRAIN</h1>
        <p className="brandSubtitle">STORE &amp; COMPUTER SHOP</p>
      </header>

      <p className="instructionText">{t('Tap an option below to begin')}</p>

      <main className="menuGrid">
        <button className="serviceCard" onClick={() => handleSelectOption('checkout')} aria-label="Self Checkout">
          <div className="cardIcon" aria-hidden="true"><Icon name="cart" size={56} /></div>
          <h2 className="cardTitle">{t('SELF CHECKOUT')}</h2>
          <p className="cardDescription">{t('Scan & pay for store items, drinks, & snacks')}</p>
        </button>

        <button className="serviceCard" onClick={() => handleSelectOption('printing')} aria-label="Printing Services">
          <div className="cardIcon" aria-hidden="true"><Icon name="printer" size={56} /></div>
          <h2 className="cardTitle">{t('PRINTING SERVICES')}</h2>
          <p className="cardDescription">{t('Print documents, photos, certificates, & files')}</p>
        </button>
      </main>

      <footer className="footerBar">
        <button className="utilityButton" onClick={() => handleSelectOption('language')}>
          <span className="buttonIcon"><Icon name="globe" size={20} /></span>
          <span className="buttonLabel">{language === 'English' ? 'Tagalog' : 'English'}</span>
        </button>

        <button className="utilityButton helpButton" onClick={() => handleSelectOption('help')}>
          <span className="buttonIcon"><Icon name="help" size={20} /></span>
          <span className="buttonLabel">{t('Help')}</span>
        </button>
      </footer>

      {isHelpModalOpen && (
        <div className="helpModalOverlay" onClick={() => setIsHelpModalOpen(false)}>
          <div className="helpModalContent" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="helpTitle">
            <h2 id="helpTitle" className="helpModalTitle">{t('Need Assistance?')}</h2>
            <div className="helpModalBody">
              <p><Icon name="pin" size={16} /> <strong>{t('Self Checkout:')}</strong> {t('Scan items using the barcode scanner and follow instructions on screen.')}</p>
              <p><Icon name="file" size={16} /> <strong>{t('Printing:')}</strong> {t('Insert your USB flash drive or transfer files via QR code.')}</p>
              <p><Icon name="user" size={16} /> <strong>{t('Staff Help:')}</strong> {t('If you need further assistance, please inform the store counter.')}</p>
            </div>
            <button className="helpModalCloseButton" onClick={() => setIsHelpModalOpen(false)}>
              {t('Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}