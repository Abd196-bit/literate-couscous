from flask import Blueprint, render_template, redirect, url_for, flash, request, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from app import db
from models import User
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, EmailField
from wtforms.validators import DataRequired, Length, Email, EqualTo, ValidationError
import logging

# Configure logging
logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

# Form classes
class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

class RegistrationForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=3, max=64)])
    email = EmailField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)])
    confirm_password = PasswordField('Confirm Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Register')
    
    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('Username already taken. Please choose a different one.')
    
    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user:
            raise ValidationError('Email already registered. Please use a different one.')

@auth_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('chat.chat_page'))
    return render_template('index.html')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    logger.info("Login route accessed")
    
    if current_user.is_authenticated:
        logger.info(f"User already authenticated: {current_user.username}")
        return redirect(url_for('chat.chat_page'))
    
    form = LoginForm()
    logger.info(f"Request method: {request.method}")
    
    if form.validate_on_submit():
        logger.info(f"Form validated, attempting login for: {form.username.data}")
        user = User.query.filter_by(username=form.username.data).first()
        
        if user and user.check_password(form.password.data):
            logger.info(f"Login successful for: {user.username}")
            
            # Create a fresh session
            if 'user_id' in session:
                session.pop('user_id')
                
            login_user(user)
            session['user_id'] = user.id
            user.status = 'online'
            db.session.commit()
            
            next_page = request.args.get('next')
            redirect_url = next_page or url_for('chat.chat_page')
            logger.info(f"Redirecting to: {redirect_url}")
            return redirect(redirect_url)
        
        logger.warning(f"Invalid login attempt for: {form.username.data}")
        flash('Invalid username or password', 'danger')
    elif request.method == 'POST':
        logger.warning(f"Form validation failed: {form.errors}")
        for field, errors in form.errors.items():
            logger.warning(f"Field {field} errors: {errors}")
    
    return render_template('login.html', form=form)

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('chat.chat_page'))
    
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(
            username=form.username.data,
            email=form.email.data
        )
        user.set_password(form.password.data)
        
        db.session.add(user)
        db.session.commit()
        
        flash('Registration successful! You can now log in.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('register.html', form=form)

@auth_bp.route('/logout')
@login_required
def logout():
    current_user.status = 'offline'
    db.session.commit()
    logout_user()
    return redirect(url_for('auth.index'))
