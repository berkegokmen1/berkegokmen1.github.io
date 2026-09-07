#!/usr/bin/env python3
"""Compatibility entry point: python3 build.py."""
import runpy
import sys
from pathlib import Path

scripts = Path(__file__).resolve().parent / 'scripts'
sys.path.insert(0, str(scripts))
runpy.run_path(str(scripts / 'build.py'), run_name='__main__')
