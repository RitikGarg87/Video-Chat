from typing import ContextManager
from django.shortcuts import render

# Create your views here.

def main_view(requset):
    Context = {}
    return render(requset, 'index.html', context=Context)