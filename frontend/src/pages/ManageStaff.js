import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ManageStaff = () => {
  const [staffList, setStaffList] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'support',
    permissions: {
      manageBookings: false,
      manageFlights: false,
      viewStats: false
    }
  });

  const fetchStaff = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/staff');
      setStaffList(res.data);
    } catch (err) {
      console.error('Error fetching staff', err);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleChange = (e) => {
    if (e.target.name in form.permissions) {
      setForm({
        ...form,
        permissions: {
          ...form.permissions,
          [e.target.name]: e.target.checked
        }
      });
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/staff', form);
      alert('Staff added successfully');
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'support',
        permissions: {
          manageBookings: false,
          manageFlights: false,
          viewStats: false
        }
      });
      fetchStaff();
    } catch (err) {
      alert('Failed to add staff');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/staff/${id}`);
      fetchStaff();
    } catch (err) {
      console.error('Error deleting staff', err);
    }
  };

  return (
    <div className="container mt-4">
      <h2>👥 Manage Staff</h2>

      <form onSubmit={handleSubmit} className="mb-4">
        <h5>Add New Staff Member</h5>
        <div className="row">
          <div className="col-md-3 mb-2">
            <input
              className="form-control"
              name="name"
              placeholder="Name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-3 mb-2">
            <input
              type="email"
              className="form-control"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-3 mb-2">
            <input
              type="password"
              className="form-control"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-3 mb-2">
            <select
              className="form-select"
              name="role"
              value={form.role}
              onChange={handleChange}
            >
              <option value="support">Support</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>
        </div>

        <div className="form-check mt-2">
          <label><input type="checkbox" name="manageBookings" checked={form.permissions.manageBookings} onChange={handleChange} /> Manage Bookings</label>
        </div>
        <div className="form-check">
          <label><input type="checkbox" name="manageFlights" checked={form.permissions.manageFlights} onChange={handleChange} /> Manage Flights</label>
        </div>
        <div className="form-check">
          <label><input type="checkbox" name="viewStats" checked={form.permissions.viewStats} onChange={handleChange} /> View Stats</label>
        </div>

        <button className="btn btn-primary mt-3" type="submit">Add Staff</button>
      </form>

      <hr />

      <h5>Existing Staff</h5>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Permissions</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {staffList.map((staff) => (
            <tr key={staff._id}>
              <td>{staff.name}</td>
              <td>{staff.email}</td>
              <td>{staff.role}</td>
              <td>
                {staff.permissions?.manageBookings && 'Bookings '}
                {staff.permissions?.manageFlights && 'Flights '}
                {staff.permissions?.viewStats && 'Stats '}
              </td>
              <td>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(staff._id)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ManageStaff;