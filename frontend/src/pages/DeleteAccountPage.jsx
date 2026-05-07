import React from 'react';

const DeleteAccountPage = () => {
  return (
    <div style={{ padding: 20 }}>
      <h1>Delete Account</h1>

      <p>
        If you wish to delete your account and all associated data, please follow the steps below.
      </p>

      <h2>Steps to delete your account</h2>
      <ul>
        <li>Send a request to our email</li>
        <li>Include your account email</li>
      </ul>

      <h2>Contact</h2>
      <p>Email: info@skybridgeflights.com</p>

      <p>
        Your account and all associated data will be permanently deleted within 7 days.
      </p>
    </div>
  );
};

export default DeleteAccountPage;