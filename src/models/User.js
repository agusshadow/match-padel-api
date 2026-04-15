import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';
import bcrypt from 'bcryptjs';

// Modelo simple de Usuario
const User = sequelize.define('User', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  email: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  role: {
    type: DataTypes.TEXT,
    defaultValue: 'user'
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

User.prototype.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

export default User;